import { useCallback, useEffect, useRef, useState } from 'react';
import { buildChatWebSocketUrl, checkGuestNickname } from '@/api/chat';
import { getToken } from '@/utils/token';
import { useAuthStore } from '@/stores/authStore';

/**
 * 聊天室消息条目。服务端广播的 {joined} / {quit} 事件归一化为系统提示，
 * 普通聊天消息保留名称/内容/时间。
 */
export interface ChatMessageEntry {
  id: number;
  kind: 'message' | 'system';
  name?: string;
  content: string;
  timestamp?: number;
  /** 该条是否已被发送者撤回 */
  recalled?: boolean;
}

export type ChatStatus = 'connecting' | 'open' | 'closed' | 'error';

// 撤回时限：与后端 chat.mjs 的 RECALL_WINDOW_MS（5 分钟）保持一致。
export const RECALL_WINDOW_MS = 5 * 60 * 1000;

const RECONNECT_DELAY = 3000;
const MAX_RECONNECT = 5;
const MAX_NAME_LENGTH = 20;
const MAX_MESSAGE_LENGTH = 2000;
// 语音通话的信令消息类型：这些消息不是聊天的广播/历史/系统事件，而是 AAA 私有点对点
// 路由（由后端按消息里的 `to` 只转发给目标会话）。收到这类消息时交给 onSignal 回调，
// 避免误当成聊天内容处理。
const CALL_SIGNAL_TYPES = new Set([
  'call.invite',
  'call.accept',
  'call.reject',
  'call.busy',
  'signal.offer',
  'signal.answer',
  'signal.ice',
  'call.hangup',
  'call.timeout',
]);
// "正在输入"节流：每多久才广播一次 typing（避免高频刷 WebSocket 状态请求）
const TYPING_THROTTLE_MS = 1600;
// 接收侧：对方停止广播后，多久自动隐藏"正在输入"提示
const TYPING_TTL_MS = 4000;

function sanitizeName(raw: string): string {
  const trimmed = (raw || '').trim().slice(0, MAX_NAME_LENGTH);
  return trimmed || '匿名';
}

function normalizeTimestamp(raw: string | number): number | undefined {
  // 服务端历史消息时间为 ISO 字符串，新消息为 epoch 毫秒
  const t = typeof raw === 'number' ? raw : Date.parse(raw);
  return Number.isFinite(t) ? t : undefined;
}

export interface UseChatRoomOptions {
  roomKey: string;
  userName: string;
  /** 该房间是否需要登录态鉴权（如全体聊天房），连接时附加 token */
  auth?: boolean;
  /**
   * 收到"别人的真实聊天消息"时回调（排除系统事件/撤回/自己发的消息）。
   * 用 ref 保存最新回调，避免触发 WebSocket 重连。
   */
  onMessage?: (entry: ChatMessageEntry) => void;
  /**
   * 收到语音通话信令（call.* / signal.* 私有路由消息）时回调。
   * 用 ref 保存最新回调，避免触发 WebSocket 重连。
   */
  onSignal?: (data: Record<string, unknown>) => void;
}

export function useChatRoom({ roomKey, userName, auth = false, onMessage, onSignal }: UseChatRoomOptions) {
  const [status, setStatus] = useState<ChatStatus>('connecting');
  const [error, setError] = useState<string>('');
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessageEntry[]>([]);
  // 当前在线名单。沿用服务端 joined/quit 事件累积：加入时服务端会把现有在线者
  // 以 {joined} 广播给所有人（含自己），离开时广播 {quit}，用 Set 天然去重。
  const [onlineNames, setOnlineNames] = useState<string[]>([]);
  // 历史分片：进房只加载最近一批（HISTORY_PAGE_SIZE 条）。是否还有更早消息 ·
  // 是否正在加载更早；用于顶部"加载更早消息"按钮的显示与加载态。
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const idRef = useRef(0);
  const reconnectRef = useRef(0);
  const closedByUserRef = useRef(false);
  const onlineSetRef = useRef(new Set<string>());
  // 保存最新 onMessage 回调，避免每次渲染导致 connect 重连
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);
  // 语音通话信令回调同样用 ref 保存最新值，避免触发重连
  const onSignalRef = useRef(onSignal);
  useEffect(() => {
    onSignalRef.current = onSignal;
  }, [onSignal]);

  // 入房首条发送的昵称（连接建立后不再随改名变化，避免触发重连）
  const initialNameRef = useRef(userName);
  // 当前服务端记录的昵称（改名/重连后同步），用于"自己发的消息不提醒"等判断
  const selfNameRef = useRef(userName);
  // 服务端是否已接受当前昵称（收到 ready/renamed 后为 true）；据此决定改名发 {rename} 还是 {name}
  const acceptedRef = useRef(false);
  // 正在进行的改名请求回调，用于把 WS 的异步回执兑现成 Promise
  const renameResolverRef = useRef<((ok: boolean) => void) | null>(null);
  const [nameRejected, setNameRejected] = useState(false);
  // 当前"正在输入…"的昵称列表（接收侧）。配合计时器在对方停止广播后自动隐去。
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const typingTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // 自己最近一次广播 typing 的时刻，用于节流（避免高频发状态请求）
  const lastTypingSentRef = useRef(0);

  const clearTyping = useCallback((raw: string) => {
    const name = sanitizeName(raw);
    if (!name) return;
    const timer = typingTimersRef.current.get(name);
    if (timer) clearTimeout(timer);
    typingTimersRef.current.delete(name);
    setTypingNames((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : prev));
  }, []);

  const addTyping = useCallback(
    (raw: string) => {
      const name = sanitizeName(raw);
      if (!name) return;
      // 自己的"正在输入"不显示给自己（后端把 typing 广播给房间所有人，含发送者自己）
      if (name === sanitizeName(selfNameRef.current)) return;
      clearTyping(name);
      setTypingNames((prev) => (prev.includes(name) ? prev : [...prev, name]));
      typingTimersRef.current.set(
        name,
        setTimeout(() => {
          typingTimersRef.current.delete(name);
          setTypingNames((prev) => prev.filter((n) => n !== name));
        }, TYPING_TTL_MS)
      );
    },
    [clearTyping]
  );

  const applyOnlineChange = useCallback(
    (name: string, present: boolean) => {
      const set = onlineSetRef.current;
      set[present ? 'add' : 'delete'](name);
      setOnlineNames(Array.from(set));
    },
    []
  );

  const nextId = useCallback(() => {
    idRef.current += 1;
    return idRef.current;
  }, []);

  const appendSystem = useCallback(
    (text: string) => {
      setMessages((prev) => [...prev, { id: nextId(), kind: 'system' as const, content: text }]);
    },
    [nextId]
  );

  // 把服务端下发的历史消息条目（元素是 {name,message,timestamp}）归一化成前端条目。
  // 进房初始历史与"加载更早"的旧消息都走这里，统一字段清洗与 id 分配。
  // 末尾按 timestamp 升序排，保证每批时间正序（旧 → 新），与追加/前插位置配合即得正确顺序。
  const buildHistoryEntries = useCallback(
    (items: unknown[]): ChatMessageEntry[] =>
      items
        .map((it) => {
          const raw = (it ?? {}) as Record<string, unknown>;
          return {
            id: nextId(),
            kind: 'message' as const,
            name: sanitizeName(String(raw.name ?? '')),
            content: String(raw.message ?? ''),
            timestamp: normalizeTimestamp(raw.timestamp as string | number),
          };
        })
        .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)),
    [nextId]
  );

  const connect = useCallback(async () => {
    if (closedByUserRef.current) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    // 建连前确保 access token 仍然有效（临近过期先静默刷新），避免聊天在 access token 过期（约 48h）后莫名断开
    await useAuthStore.getState().ensureSession();
    setStatus('connecting');
    // 已登录用户（有 token）无论进哪种房都带 token，供 Pages 握手时判定身份。
    const loggedIn = !!getToken();
    const token = auth || loggedIn ? getToken() : undefined;
    // “昵称占用”防护只针对游客（防止游客用昵称冒充注册账号）。已登录用户的用户名随 ws 的
    // { name } 走，不再携带 nickname 查重参数，否则自己的真名会被误判为“已被注册用户占用”而进不去。
    const nickname = auth || loggedIn ? undefined : sanitizeName(initialNameRef.current);
    const ws = new WebSocket(buildChatWebSocketUrl(roomKey, token, nickname));
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('open');
      setConnected(true);
      setError('');
      setNameRejected(false);
      acceptedRef.current = false;
      // 入房首条必须发送昵称，服务端据此登记并广播 joined；改名不通过重连，见 setNickname
      const myName = sanitizeName(initialNameRef.current);
      selfNameRef.current = myName;
      onlineSetRef.current.clear();
      // 自己即刻入榜；随后服务端广播其余在线者的 joined 会陆续加入
      onlineSetRef.current.add(myName);
      setOnlineNames([myName]);
      ws.send(JSON.stringify({ name: myName }));
    };

    ws.onmessage = (ev) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(String(ev.data));
      } catch {
        return;
      }

      // 语音通话信令：按 type 识别，交给 onSignal 做点对点路由处理。
      // 这类消息带有私有 `to` 字段，只属于通话双方，不应走下面的聊天消息逻辑。
      if (typeof data.type === 'string' && CALL_SIGNAL_TYPES.has(data.type)) {
        onSignalRef.current?.(data);
        return;
      }

      if (data.ready === true) {
        // 服务端已接受昵称并派出历史：视为"已有昵称"，后续改名走 {rename}；
        // 同时兑现"重建连接"场景（如 Pages 拒绝后换名重连）中挂起的校验。
        acceptedRef.current = true;
        setNameRejected(false);
        const resolve = renameResolverRef.current;
        renameResolverRef.current = null;
        resolve?.(true);
        return;
      }
      if (data.error) {
        // 昵称问题（重名/非法）是"可恢复"错误：透出提示但不当作致命连接错误
        if (data.code === 'name_taken' || data.code === 'name_invalid') {
          setError(String(data.error));
          if (!acceptedRef.current) setNameRejected(true);
          const resolve = renameResolverRef.current;
          renameResolverRef.current = null;
          resolve?.(false);
          return;
        }
        // Pages 拒绝（409）：所填昵称已被注册用户占用。握手阶段被拒时连接已关闭，
        // 需停止自动重连（否则会循环），等用户在编辑态换名后走 setNickname 重建连接。
        if (data.code === 409) {
          setError(String(data.error));
          if (!acceptedRef.current) {
            setNameRejected(true);
            closedByUserRef.current = true;
          }
          const resolve = renameResolverRef.current;
          renameResolverRef.current = null;
          resolve?.(false);
          return;
        }
        setError(String(data.error));
        return;
      }
      if (data.renamed === true) {
        // 改名成功：同步当前昵称（不重连、不清理消息，供别人看到的离开/加入广播由服务端旁路带到）
        const newName = sanitizeName(String(data.name ?? ''));
        selfNameRef.current = newName;
        initialNameRef.current = newName;
        acceptedRef.current = true;
        setError('');
        const resolve = renameResolverRef.current;
        renameResolverRef.current = null;
        resolve?.(true);
        return;
      }
      if (typeof data.joined === 'string') {
        appendSystem(`${data.joined} 加入聊天`);
        applyOnlineChange(data.joined, true);
        return;
      }
      if (typeof data.quit === 'string') {
        appendSystem(`${data.quit} 离开聊天`);
        applyOnlineChange(data.quit, false);
        return;
      }
      // 进房初始历史：服务端一次推送最近一批（时间正序，旧 → 新），直接追加到末尾。
      if (data.history && typeof data.history === 'object') {
        const h = data.history as { items?: unknown[]; hasMore?: boolean };
        const entries = buildHistoryEntries(Array.isArray(h.items) ? h.items : []);
        setMessages((prev) => [...prev, ...entries]);
        setHasMoreHistory(Boolean(h.hasMore));
        return;
      }
      // 加载更早：服务端推送的一批旧消息（时间正序，旧 → 新），从最前插入。
      if (data.historyOlder && typeof data.historyOlder === 'object') {
        const h = data.historyOlder as { items?: unknown[]; hasMore?: boolean };
        setLoadingOlder(false);
        const entries = buildHistoryEntries(Array.isArray(h.items) ? h.items : []);
        setMessages((prev) => [...entries, ...prev]);
        setHasMoreHistory(Boolean(h.hasMore));
        return;
      }
      if (typeof data.message === 'string') {
        const entry: ChatMessageEntry = {
          id: nextId(),
          kind: 'message' as const,
          name: sanitizeName(String(data.name ?? '')),
          content: String(data.message),
          timestamp: normalizeTimestamp(data.timestamp as string | number),
        };
        setMessages((prev) => [...prev, entry]);
        // 对方真的把消息发出来了：立即清除其"正在输入"提示
        if (entry.name) clearTyping(entry.name);
        // 仅对"别人的消息"触发外部回调（如桌面通知），自己不提醒
        if (entry.name && entry.name !== sanitizeName(selfNameRef.current)) {
          onMessageRef.current?.(entry);
        }
        return;
      }
      // 对方正在输入：展示其"正在输入…"提示（随超时清除）
      if (typeof data.typing === 'string') {
        addTyping(data.typing);
        return;
      }
      // 撤回：把对应时间戳的消息标记为已撤回（保留条目用于显示"XX 撤回了一条消息"）。
      if (typeof data.recalled === 'number') {
        setMessages((prev) =>
          prev.map((m) => (m.timestamp === data.recalled ? { ...m, recalled: true } : m))
        );
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (closedByUserRef.current) {
        setStatus('closed');
        return;
      }
      setError('');
      // 非主动关闭：自动重连
      if (reconnectRef.current < MAX_RECONNECT) {
        reconnectRef.current += 1;
        setTimeout(connect, RECONNECT_DELAY);
      } else {
        setStatus('error');
      }
    };

    ws.onerror = () => {
      setError('连接出错了，正在重试…');
    };
  }, [roomKey, auth, applyOnlineChange, appendSystem, buildHistoryEntries, nextId, addTyping, clearTyping]);

  useEffect(() => {
    closedByUserRef.current = false;
    reconnectRef.current = 0;
    setMessages([]);
    setError('');
    connect();
    return () => {
      closedByUserRef.current = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      const ws = wsRef.current;
      if (!trimmed || !ws || ws.readyState !== WebSocket.OPEN) return false;
      ws.send(JSON.stringify({ message: trimmed.slice(0, MAX_MESSAGE_LENGTH) }));
      return true;
    },
    []
  );

  /**
   * 发送任意信令（语音通话的 call.* / signal.*）。消息需自带 `to`（目标昵称），
   * 后端会按昵称点对点路由到目标会话，不会广播给房间其他人。
   */
  const sendSignal = useCallback((payload: Record<string, unknown>): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(payload));
    return true;
  }, []);

  /**
   * 广播"正在输入"状态（节流）。由输入框在"聚焦且非空"时周期性调用；
   * 节流防止高频发送 WebSocket 状态请求。接收侧靠超时与真实消息自动清除提示，
   * 因此这里无需发送"停止"事件。
   */
  const sendTyping = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return;
    lastTypingSentRef.current = now;
    ws.send(JSON.stringify({ typing: true }));
  }, []);

  const recallMessage = useCallback(
    (timestamp: number) => {
      const ws = wsRef.current;
      // 仅限 5 分钟撤回窗口内、且连接正常时发送
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;
      if (!Number.isFinite(timestamp) || Date.now() - timestamp > RECALL_WINDOW_MS) return false;
      ws.send(JSON.stringify({ recall: timestamp }));
      return true;
    },
    []
  );

  /**
   * 历史分片：请求"当前最早一条消息"更早的一批。以该条的时间戳为游标发给服务端，
   * 服务端返回 { historyOlder }，由 onmessage 处理为插入到列表最前。
   * 注意游标必须是"最早一条"（messages[0]），后端按 endExclusive 取比它更旧的；
   * 若误传最新一条，会拿到一堆已显示过的重复消息并把 hasMore 判反，导致加载停滞。
   */
  const loadOlder = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || loadingOlder) return;
    let before: number | undefined;
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.kind === 'message' && typeof m.timestamp === 'number') {
        before = m.timestamp;
        break;
      }
    }
    if (before === undefined) return;
    setLoadingOlder(true);
    ws.send(JSON.stringify({ getOlder: before }));
  }, [messages, loadingOlder]);

  /**
   * 设置/修改昵称（不清理消息）。
   * - 连接已建立：服务端已接受昵称时，先经 Pages 校验是否占用注册用户名（冲突则拦截），
   *   通过后发 { rename }；否则（首条昵称被拒后）直接发 { name }。
   * - 连接已断开（如 Pages 握手阶段拒绝注册用户名）：带新昵称重建连接，成功在 ready 时兑现。
   * 返回 Promise<boolean>：通过 = true；被拒或连接异常 = false。
   */
  const setNickname = useCallback(
    async (nickname: string): Promise<boolean> => {
      const trimmed = nickname.trim();
      if (!trimmed) return false;
      if (renameResolverRef.current) return false; // 已有改名校验进行中
      const ws = wsRef.current;
      const isOpen = !!ws && ws.readyState === WebSocket.OPEN;

      if (!isOpen) {
        // 连接已断开（Pages 拒绝后的初始）：换名后重建连接；结果在 ready(成功)/409(失败) 兑现
        return new Promise<boolean>((resolve) => {
          renameResolverRef.current = resolve;
          closedByUserRef.current = false;
          initialNameRef.current = trimmed;
          selfNameRef.current = trimmed;
          connect();
        });
      }

      if (acceptedRef.current) {
        // 在线改名：先经 Pages 主机查注册用户名，命中则拦截，不打扰聊天连接
        const check = await checkGuestNickname(trimmed);
        if (!check.ok) {
          setError(check.message || '该昵称已被占用');
          return false;
        }
      }

      return new Promise<boolean>((resolve) => {
        renameResolverRef.current = resolve;
        ws.send(JSON.stringify(acceptedRef.current ? { rename: trimmed } : { name: trimmed }));
      });
    },
    [connect]
  );

  return { status, connected, error, messages, hasMoreHistory, loadingOlder, loadOlder, sendMessage, sendSignal, sendTyping, typingNames, recallMessage, setNickname, nameRejected, onlineNames };
}