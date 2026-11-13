import { useCallback, useEffect, useRef, useState } from 'react';
import { agentChatStream, confirmAgentAction, undoAgentWrite } from '@/api/ai';

// AI 写操作的确认卡 / 结果卡（内嵌为消息的一部分，对话不截断）
export interface AgentConfirmAction {
  token: string;
  skill: string;
  target: string;
  params?: string;
  message?: string; // 执行完成后的结果文案
  undoPreview?: string; // 回滚预览：回滚将恢复到什么状态
  status: 'waiting' | 'rejected' | 'resolved' | 'done' | 'failed' | 'rolling_back' | 'rolled_back';
  undoId?: string;
}

export interface AgentStep {
  kind: 'think' | 'tool' | 'content' | 'action';
  id: string;
  idx?: number;
  text?: string;
  name?: string;
  status?: 'running' | 'done' | 'error';
  summary?: string;
  params?: string;
  output?: string;
  /** 仅 kind === 'action' 时存在：写操作确认/结果数据 */
  action?: AgentConfirmAction;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  steps?: AgentStep[];
  /** AI 发起的写操作确认/结果卡（作为该条 AI 消息的一部分，随消息持久化） */
  action?: AgentConfirmAction;
  rounds?: number;
  usage?: { prompt: number; completion: number; total: number };
  timestamp: number;
}

export interface AgentDialog {
  id: string;
  title: string;
  messages: AgentMessage[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'xinblog.agent.dialogs';

let idCounter = 0;
function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

function makeDialog(): AgentDialog {
  const now = Date.now();
  return { id: nextId('dlg'), title: '新对话', messages: [], createdAt: now, updatedAt: now };
}

// 有效对话判定：本地发过任意消息才算对话，空壳不保存 / 不展示
function isMeaningfulDialog(d: AgentDialog | null | undefined): boolean {
  if (!d) return false;
  return Array.isArray(d.messages) && d.messages.some((m) => m.content);
}

function loadDialogs(): AgentDialog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (d) => d && typeof d.id === 'string' && Array.isArray(d.messages) && isMeaningfulDialog(d)
    ) as AgentDialog[];
  } catch {
    return [];
  }
}

function persistDialogs(dialogs: AgentDialog[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dialogs.filter(isMeaningfulDialog)));
  } catch {
    /* 存储失败（隐私模式/超限）静默忽略 */
  }
}

export function useAgentDialogs(bootstrap = true) {
  const [dialogs, setDialogs] = useState<AgentDialog[]>(() => loadDialogs());
  const [activeId, setActiveId] = useState<string | null>(() => null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (!bootstrap || bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    setDialogs((prev) => {
      if (prev.length > 0) {
        setActiveId((a) => a ?? prev[0].id);
        return prev;
      }
      const dlg = makeDialog();
      setActiveId(dlg.id);
      return [dlg];
    });
  }, [bootstrap]);

  // 持久化到 localStorage
  useEffect(() => {
    persistDialogs(dialogs);
  }, [dialogs]);

  const activeDialog = dialogs.find((d) => d.id === activeId) ?? null;

  const createDialog = useCallback(() => {
    const dlg = makeDialog();
    setDialogs((prev) => [dlg, ...prev]);
    setActiveId(dlg.id);
    return dlg.id;
  }, []);

  // 确保某个 id 存在一个（空）对话：用于"新建对话"跳转后本地还没该壳时
  const ensureDialog = useCallback((id: string) => {
    setDialogs((prev) => {
      if (prev.some((d) => d.id === id)) return prev;
      const now = Date.now();
      return [{ id, title: '新对话', messages: [], createdAt: now, updatedAt: now }, ...prev];
    });
    setActiveId(id);
  }, []);

  const selectDialog = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const renameDialog = useCallback((id: string, title: string) => {
    const t = title.trim();
    if (!t) return;
    setDialogs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, title: t.slice(0, 60) } : d))
    );
  }, []);

  const deleteDialog = useCallback(
    async (id: string): Promise<boolean> => {
      abortRef.current?.abort();
      let remaining = dialogs.filter((d) => d.id !== id);
      if (remaining.length === 0) remaining = [makeDialog()];
      setDialogs(remaining);
      if (activeId === id) setActiveId(remaining[0].id);
      return true;
    },
    [dialogs, activeId]
  );

  const clearDialogs = useCallback(() => {
    abortRef.current?.abort();
    const dlg = makeDialog();
    setDialogs([dlg]);
    setActiveId(dlg.id);
  }, []);

  const send = useCallback(
    async (text: string, targetId?: string, mode?: 'warm' | 'humorous' | 'professional', model?: string) => {
      const dlgId = targetId ?? activeId;
      const trimmed = text.trim();
      if (!dlgId || !trimmed) return;

      const dlg = dialogs.find((d) => d.id === dlgId);
      if (!dlg) return;

      const userMsg: AgentMessage = {
        id: nextId('msg'),
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      };
      const aiMsgId = nextId('msg');
      const aiMsg: AgentMessage = {
        id: aiMsgId,
        role: 'assistant',
        content: '',
        steps: [],
        timestamp: Date.now(),
      };

      // 全量历史随请求发出（无状态后端，不落库）
      const history = [...dlg.messages, userMsg];
      const payload = history.filter((m) => m.content).map((m) => ({ role: m.role, content: m.content }));

      setDialogs((prev) =>
        prev.map((d) => {
          if (d.id !== dlgId) return d;
          const untitled = !d.title || d.title === '新对话';
          const now = Date.now();
          return {
            ...d,
            title: untitled ? trimmed.slice(0, 20) : d.title,
            updatedAt: now,
            messages: [...d.messages, userMsg, aiMsg],
          };
        })
      );
      setLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const patch = (fn: (m: AgentMessage) => AgentMessage) =>
        setDialogs((prev) =>
          prev.map((d) =>
            d.id === dlgId
              ? { ...d, messages: d.messages.map((m) => (m.id === aiMsgId ? fn(m) : m)) }
              : d
          )
        );

      try {
        const res = await agentChatStream(payload, { mode, model });
        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          throw new Error(errText || `请求失败 (${res.status})`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('无法读取响应流');

        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';
        let gotAnyContent = false;

        while (true) {
          const { done: isDone, value } = await reader.read();
          if (isDone) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith('data:')) continue;
            const jsonText = trimmedLine.slice(5).trim();
            if (!jsonText || jsonText === '[DONE]') continue;
            let evt;
            try {
              evt = JSON.parse(jsonText);
            } catch {
              continue;
            }
            const type = evt?.type;
            const data = evt?.data ?? {};
            if (type === 'think_delta') {
              patch((m) => {
                const steps = m.steps || [];
                const lastIdx = steps.length - 1;
                const seg = data.text ?? '';
                if (lastIdx >= 0 && steps[lastIdx].kind === 'think') {
                  return {
                    ...m,
                    steps: steps.map((s, i) => (i === lastIdx ? { ...s, text: (s.text || '') + seg } : s)),
                  };
                }
                return {
                  ...m,
                  steps: [...steps, { kind: 'think', id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: seg, status: 'done' }],
                };
              });
            } else if (type === 'tool_start') {
              patch((m) => ({
                ...m,
                steps: [
                  ...(m.steps || []),
                  { kind: 'tool', id: data.id, name: data.name, status: 'running', params: data.params, idx: data.idx },
                ],
              }));
            } else if (type === 'tool_result') {
              patch((m) => ({
                ...m,
                steps: (m.steps || []).map((s) =>
                  s.id === data.id && s.kind === 'tool'
                    ? { ...s, status: data.ok ? 'done' : 'error', summary: data.summary, output: data.output, idx: data.idx ?? s.idx }
                    : s
                ),
              }));
            } else if (type === 'stats') {
              const u = data.tokens ?? {};
              patch((m) => ({
                ...m,
                rounds: data.rounds,
                usage: { prompt: u.prompt ?? 0, completion: u.completion ?? 0, total: u.total ?? 0 },
              }));
            } else if (type === 'content_delta') {
              gotAnyContent = true;
              const seg = data.text ?? '';
              accumulated += seg;
              patch((m) => {
                const steps = m.steps || [];
                const lastIdx = steps.length - 1;
                if (lastIdx >= 0 && steps[lastIdx].kind === 'content') {
                  return {
                    ...m,
                    content: accumulated,
                    steps: steps.map((s, i) => (i === lastIdx ? { ...s, text: (s.text || '') + seg } : s)),
                  };
                }
                return {
                  ...m,
                  content: accumulated,
                  steps: [...steps, { kind: 'content', id: `sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: seg, status: 'done' }],
                };
              });
            } else if (type === 'confirm_request') {
              // 确认卡内嵌为当前 AI 消息的 action（对话不截断）
              patch((m) => ({
                ...m,
                action: {
                  token: data.token,
                  skill: data.skill,
                  target: data.target,
                  params: data.params,
                  status: 'waiting',
                },
              }));
            } else if (type === 'write_result') {
              // 写操作执行完成（成功/失败）：成功携带 undoId 可回滚，失败展示错误
              const failed = data.ok === false;
              patch((m) =>
                m.action && m.action.token === data.token
                  ? {
                      ...m,
                      action: {
                        ...m.action,
                        status: failed ? 'failed' : 'done',
                        message: failed ? data.error || data.message || '操作执行失败' : data.message,
                        undoId: failed ? undefined : data.undoId || data.token,
                        undoPreview: data.undoPreview,
                      },
                    }
                  : m
              );
            } else if (type === 'error') {
              patch((m) => ({
                ...m,
                content: m.content || `出错了：${data.message ?? '未知错误'}`,
              }));
            } else if (type === 'done') {
              // 无状态：无需回填会话，流结束
              break;
            }
          }
        }

        if (!gotAnyContent) {
          patch((m) => ({ ...m, content: m.content || '抱歉，我没有收到有效回复，请稍后重试。' }));
        }
      } catch (err) {
        patch((m) => ({
          ...m,
          content: `出错了：${err instanceof Error ? err.message : String(err)}`,
        }));
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [dialogs, activeId]
  );

  const confirmAction = useCallback(async (token: string, approved: boolean) => {
    const ok = await confirmAgentAction(token, approved).catch(() => false);
    if (ok) {
      setDialogs((prev) =>
        prev.map((d) => ({
          ...d,
          messages: d.messages.map((m) =>
            m.action && m.action.token === token
              ? { ...m, action: { ...m.action, status: approved ? 'resolved' : 'rejected' } }
              : m
          ),
        }))
      );
    }
    return ok;
  }, []);

  // 回滚已执行的写操作：成功后把对应结果卡标记为已回滚
  const undoAction = useCallback(async (undoId: string, token?: string): Promise<{ ok: boolean; msg?: string }> => {
    const res = await undoAgentWrite(undoId).catch(() => ({ ok: false, msg: '回滚请求失败' }));
    if (res.ok) {
      setDialogs((prev) =>
        prev.map((d) => ({
          ...d,
          messages: d.messages.map((m) =>
            m.action && m.action.token === token && m.action.status === 'done'
              ? { ...m, action: { ...m.action, status: 'rolled_back' } }
              : m
          ),
        }))
      );
    }
    return res;
  }, []);

  return {
    dialogs,
    activeId,
    activeDialog,
    messages: activeDialog ? activeDialog.messages : [],
    loading,
    confirmAction,
    undoAction,
    createDialog,
    ensureDialog,
    selectDialog,
    renameDialog,
    deleteDialog,
    clearDialogs,
    send,
  };
}