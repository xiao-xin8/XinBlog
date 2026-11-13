import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Avatar,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
  CircularProgress,
  alpha,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import UndoIcon from '@mui/icons-material/Undo';
import type { ChatMessageEntry } from '@/hooks/useChatRoom';
import { RECALL_WINDOW_MS } from '@/hooks/useChatRoom';
import ChatMessageContent from './ChatMessageContent';
import { getChatBubbleRenderer } from '@/themes/chatBubble/renderers';
import { useSiteStore } from '@/stores/siteStore';

function formatTime(ts?: number): string {
  if (!ts || Number.isNaN(ts)) return '';
  return new Date(ts).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface ChatMessageListProps {
  messages: ChatMessageEntry[];
  /** 聊天室 key：透传给消息渲染，用于还原图片 URL */
  roomKey: string;
  currentUserName?: string;
  // 当前会话用过的所有名字（含改名前的旧名），用于跨改名校验"哪些消息是我的"
  selfNames?: string[];
  loading?: boolean;
  // 历史分片：进房只加载最近一批；是否还有更早消息 / 是否正在加载更早
  hasMoreHistory?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  onCopy?: (msg: ChatMessageEntry) => void;
  onQuote?: (msg: ChatMessageEntry) => void;
  onRecall?: (msg: ChatMessageEntry) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  msg: ChatMessageEntry;
}

export default function ChatMessageList({
  messages,
  roomKey,
  currentUserName,
  selfNames,
  loading = false,
  hasMoreHistory = false,
  loadingOlder = false,
  onLoadOlder,
  onCopy,
  onQuote,
  onRecall,
}: ChatMessageListProps) {
  const theme = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);

  // 主题弧度：与 Friends/About 等页面保持一致的圆角基准（theme.shape.borderRadius）
  const radius = theme.shape.borderRadius;

  // —— 聊天气泡主题 ——
  // 读取站点配置 chatBubbleTheme，用渲染器把参数映射为“自己/对方”的气泡样式。
  // 未配置（variant 为空/默认）时渲染器返回 undefined，回退到下方默认气泡配色。
  const site = useSiteStore();
  const bubbleTheme = site.config.chatBubbleTheme || { variant: 'default' };
  const bubbleRenderer = getChatBubbleRenderer(bubbleTheme.variant);
  const bubbleStyles = useMemo(() => {
    if (!bubbleRenderer) return null;
    const params = { ...bubbleRenderer.defaultParams, ...(bubbleTheme.params || {}) };
    return bubbleRenderer.render(params, {
      // 主题色一律取自项目真实主题色（MUI primary），而非站点独立字段
      themeColor: theme.palette.primary.main,
      borderRadius: theme.shape.borderRadius ?? 16,
    });
  }, [bubbleRenderer, bubbleTheme.params, theme.palette.primary.main, theme.shape.borderRadius]);

  // 每条消息 DOM 的引用表（按时间戳索引），用于点击引用时滚动定位
  const messageRefs = useRef(new Map<number, HTMLDivElement>());

  // 右键菜单锚点；pressedId 用于给被右键的气泡一个"轻弹"反馈
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [pressedId, setPressedId] = useState<number | null>(null);
  // 点击引用后短暂高亮的消息时间戳
  const [highlightTs, setHighlightTs] = useState<number | null>(null);

  // 新消息到达时自动滚动到底部。注意"加载更早消息"是在顶部插入旧消息，
  // 此时不应把用户拽回底部：只有"首批历史/末尾新增"才滚动到底。
  const prevFirstRef = useRef<ChatMessageEntry | null>(null);
  const prevLastRef = useRef<ChatMessageEntry | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const prevFirst = prevFirstRef.current;
    const prevLast = prevLastRef.current;
    prevFirstRef.current = messages.length ? messages[0] : null;
    prevLastRef.current = messages.length ? messages[messages.length - 1] : null;
    const firstChanged = messages.length > 0 && messages[0] !== prevFirst;
    const lastChanged = messages.length > 0 && messages[messages.length - 1] !== prevLast;
    const appended = lastChanged && !firstChanged; // 末尾新增（含首批历史 / 实时新消息）
    if (appended || (prevFirst == null && messages.length > 0)) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // 消息列表是 <main> 内部的独立滚动容器。全局 useSmoothScroll 会在 <main>
  // 上监听 wheel 并 preventDefault，吞掉这里的事件导致列表滚不动。
  // 在捕获阶段阻断事件继续冒泡到 <main>，让内部恢复原生滚动。
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const stopWheel = (e: WheelEvent) => e.stopPropagation();
    el.addEventListener('wheel', stopWheel, { capture: true });
    return () => el.removeEventListener('wheel', stopWheel, { capture: true });
  }, []);

  // 点击引用条：滚动定位到被引用的那条消息，并带一个短暂高亮。
  // 直接对内部滚动容器 scrollTo，滚动目标明确不受外层容器影响。
  // 用 useCallback 保持引用稳定，配合 ChatMessageContent 的 React.memo，
  // 避免点击在线列表/右键菜单等无关重渲染时重建每条消息的 markdown 与图片。
  const scrollToTimestamp = useCallback(
    (ts: number) => {
      const el = messageRefs.current.get(ts);
      const container = scrollRef.current;
      if (!el || !container) return;
      setHighlightTs(ts);
      window.setTimeout(() => setHighlightTs((cur) => (cur === ts ? null : cur)), 2200);
      const cRect = container.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      const top = eRect.top - cRect.top + container.scrollTop - cRect.height / 2 + eRect.height / 2;
      container.scrollTo({ top, behavior: 'smooth' });
    },
    []
  );

  const canRecall = (msg: ChatMessageEntry): boolean => {
    return Boolean(msg.timestamp) && Date.now() - (msg.timestamp as number) <= RECALL_WINDOW_MS;
  };

  // —— 手机端长按触发菜单 ——
  // touchStartRef: 长按起点；长按计时器；两者都在滚动/松开时被清除
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 统一在指定坐标弹出菜单（右键 / 长按共用）
  const openContextMenuAt = (x: number, y: number, msg: ChatMessageEntry) => {
    setMenu({ x, y, msg });
    // 触发的瞬间给气泡一个"弹一下"的反馈，避免干巴巴
    setPressedId(msg.id);
    window.setTimeout(() => setPressedId((cur) => (cur === msg.id ? null : cur)), 300);
  };

  const openContextMenu = (ev: React.MouseEvent, msg: ChatMessageEntry) => {
    ev.preventDefault();
    ev.stopPropagation();
    openContextMenuAt(ev.clientX, ev.clientY, msg);
  };

  // 手指按下，约 480ms 内未移动则判定为长按
  const onTouchStart = (ev: React.TouchEvent, msg: ChatMessageEntry) => {
    const t = ev.touches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      openContextMenuAt(t.clientX, t.clientY, msg);
    }, 480);
  };

  // 手指移动超过 10px（通常意味着在滚动/拖动）则取消长按
  const onTouchMove = (ev: React.TouchEvent) => {
    const start = touchStartRef.current;
    const t = ev.touches[0];
    if (!start || !t) return;
    if (Math.abs(t.clientX - start.x) > 10 || Math.abs(t.clientY - start.y) > 10) {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      touchStartRef.current = null;
    }
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    touchStartRef.current = null;
  };

  const closeMenu = () => setMenu(null);

  const runAction = (action: 'copy' | 'quote' | 'recall') => {
    if (!menu) return;
    const { msg } = menu;
    closeMenu();
    if (action === 'copy' && onCopy) onCopy(msg);
    else if (action === 'quote' && onQuote) onQuote(msg);
    else if (action === 'recall' && onRecall) onRecall(msg);
  };

  if (messages.length === 0 && loading) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.secondary',
          gap: 1.5,
          p: 4,
        }}
      >
        <CircularProgress size={32} thickness={4} />
        <Typography variant="body2">连接中…</Typography>
      </Box>
    );
  }

  if (messages.length === 0) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.secondary',
          p: 4,
        }}
      >
        <Typography variant="body2">还没有消息，快来抢占沙发~</Typography>
      </Box>
    );
  }

  return (
    <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', px: { xs: 1.5, sm: 2 }, py: 2 }}>
      {/* 历史分片：还有更早消息时，在顶部提供"加载更早消息"入口 */}
      {hasMoreHistory && !loadingOlder && (
        <Box sx={{ textAlign: 'center', py: 1, mb: 1 }}>
          <Button size="small" variant="outlined" onClick={onLoadOlder} sx={{ textTransform: 'none', borderRadius: 1 }}>
            加载更早消息
          </Button>
        </Box>
      )}
      {loadingOlder && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1, mb: 1 }}>
          <CircularProgress size={20} />
        </Box>
      )}
      {messages.map((msg) => {
        if (msg.kind === 'system') {
          return (
            <Box key={msg.id} sx={{ textAlign: 'center', my: 1 }}>
              <Typography
                variant="caption"
                sx={{
                  display: 'inline-block',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 10,
                  bgcolor: (t) => alpha(t.palette.text.secondary, 0.08),
                  color: 'text.secondary',
                }}
              >
                {msg.content}
              </Typography>
            </Box>
          );
        }

        // 已撤回：内容连同原文一起消失，只留一条置中的提示
        if (msg.recalled) {
          return (
            <Box key={msg.id} sx={{ textAlign: 'center', my: 1 }}>
              <Typography
                variant="caption"
                sx={{
                  color: (t) => alpha(t.palette.text.secondary, 0.55),
                  fontSize: 12,
                  userSelect: 'none',
                }}
              >
                {msg.name ? `${msg.name} 撤回了一条消息` : '消息已撤回'}
              </Typography>
            </Box>
          );
        }

        // 归属判定改用"本会话用过的所有名字"，改名后旧消息仍算自己发的
        const mine = !!currentUserName && !!selfNames?.includes(msg.name ?? '');
        // 自己的消息统一显示当前用户名，使改名完成的瞬间即刷新为新名
        const shownName = mine && currentUserName ? currentUserName : msg.name;
        return (
          <Box
            key={msg.id}
            ref={(node: HTMLDivElement | null) => {
              if (msg.timestamp === undefined) return;
              if (node) messageRefs.current.set(msg.timestamp, node);
              else messageRefs.current.delete(msg.timestamp);
            }}
            sx={{
              display: 'flex',
              gap: 1,
              mb: 1.5,
              // 头像贴顶部（对方在左上角，自己在右上角）
              alignItems: 'flex-start',
              flexDirection: mine ? 'row-reverse' : 'row',
              // 被引用定位时：整行高亮提示位置
              ...(Number.isFinite(highlightTs) && highlightTs === msg.timestamp
                ? {
                    borderRadius: `${radius}px`,
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                    boxShadow: (t) => `0 0 0 2px ${alpha(t.palette.primary.main, 0.5)}`,
                  }
                : {}),
            }}
          >
            <Avatar
              sx={{
                width: 34,
                height: 34,
                flexShrink: 0,
                bgcolor: (t) => (mine ? alpha(t.palette.primary.main, 0.18) : alpha(t.palette.secondary.main, 0.18)),
                color: mine ? 'primary.main' : 'secondary.main',
                // 占位字放大，并使用系统正常字体（不套用全局自定义字体）
                fontSize: 18,
                fontWeight: 700,
                fontFamily: '"tahoma", "arial", sans-serif',
              }}
            >
              {shownName?.charAt(0) ?? '访'}
            </Avatar>
            <Box sx={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  {shownName}
                </Typography>
                {Boolean(msg.timestamp) && (
                  <Typography variant="caption" sx={{ color: alpha(theme.palette.text.secondary, 0.6), fontSize: 11 }}>
                    {formatTime(msg.timestamp)}
                  </Typography>
                )}
              </Box>
              <Box
                onContextMenu={(e) => openContextMenu(e, msg)}
                onTouchStart={(e) => onTouchStart(e, msg)}
                onTouchMove={onTouchMove}
                onTouchEnd={cancelLongPress}
                onTouchCancel={cancelLongPress}
                sx={{
                  cursor: 'context-menu',
                  touchAction: 'pan-y', // 允许垂直滚动，长按判定在手势层处理
                  minWidth: 0,
                  maxWidth: '100%',
                  // 长内容（超长英文/网址/无空格文本）在词中断行，防止把气泡撑破、溢出页面
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  px: 1.5,
                  py: 0.9,
                  // 聊天气泡主题：命中渲染器则整体覆盖配色与圆角（含尖角逻辑）
                  ...(bubbleStyles ? (mine ? bubbleStyles.mine : bubbleStyles.other) : {}),
                  // 未启用主题时的默认气泡配色
                  ...(!bubbleStyles
                    ? {
                        // 贴近头像的一角（顶部）为小圆角，其余三侧为统一主题弧度
                        borderRadius: mine
                          ? `${radius}px 4px ${radius}px ${radius}px`
                          : `4px ${radius}px ${radius}px ${radius}px`,
                        bgcolor: (t: Theme) =>
                          mine
                            ? alpha(t.palette.primary.main, 0.12)
                            : alpha(t.palette.text.primary, 0.06),
                        border: (t: Theme) => `1px solid ${alpha(t.palette.divider, 0.6)}`,
                      }
                    : {}),
                  color: 'text.primary',
                  fontSize: '0.92rem',
                  lineHeight: 1.55,
                  // 被右键时轻微弹一下，给出触感反馈
                  transformOrigin: 'center',
                  animation: pressedId === msg.id ? 'chatPress 0.28s ease' : 'none',
                  '@keyframes chatPress': {
                    '0%': { transform: 'scale(1)' },
                    '45%': { transform: 'scale(1.06)' },
                    '100%': { transform: 'scale(1)' },
                  },
                }}
              >
                <ChatMessageContent
                content={msg.content}
                roomKey={roomKey}
                imageSx={bubbleStyles ? (mine ? bubbleStyles.mineImage : bubbleStyles.otherImage) : undefined}
                onReplyQuoteClick={scrollToTimestamp}
              />
              </Box>
            </Box>
          </Box>
        );
      })}

      {/* 右键菜单 */}
      <Menu
        open={Boolean(menu)}
        onClose={closeMenu}
        anchorReference="anchorPosition"
        anchorPosition={menu ? { top: menu.y, left: menu.x } : undefined}
        slotProps={{
          paper: {
            elevation: 3,
            sx: {
              minWidth: 160,
              borderRadius: 2,
              py: 0.5,
              '& .MuiMenuItem-root': { fontSize: '0.9rem' },
            },
          },
        }}
      >
        <MenuItem onClick={() => runAction('copy')}>
          <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
          复制
        </MenuItem>
        <MenuItem onClick={() => runAction('quote')}>
          <ListItemIcon><FormatQuoteIcon fontSize="small" /></ListItemIcon>
          引用
        </MenuItem>
        {menu && selfNames?.includes(menu.msg.name ?? '') && canRecall(menu.msg) && (
          <>
            <Divider sx={{ my: 0.5 }} />
            <MenuItem onClick={() => runAction('recall')} sx={{ color: 'error.main' }}>
              <ListItemIcon><UndoIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
              撤回
            </MenuItem>
          </>
        )}
      </Menu>
    </Box>
  );
}