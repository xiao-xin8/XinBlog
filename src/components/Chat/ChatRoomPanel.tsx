import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemText,
  Switch,
  SwipeableDrawer,
  TextField,
  Tooltip,
  Typography,
  IconButton,
  alpha,
  Fade,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ForumIcon from '@mui/icons-material/Forum';
import PeopleIcon from '@mui/icons-material/People';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import PhoneIcon from '@mui/icons-material/Phone';
import VideocamIcon from '@mui/icons-material/Videocam';
import ChatMessageList from './ChatMessageList';
import ChatInput from './ChatInput';
import { useChatRoom } from '@/hooks/useChatRoom';
import { useVoiceCall } from '@/hooks/useVoiceCall';
import type { CallKind } from '@/hooks/useVoiceCall';
import VoiceCallCard from '@/components/Call/VoiceCallCard';
import VideoCallCard from '@/components/Call/VideoCallCard';
import { useChatNotifications } from '@/hooks/useChatNotifications';
import { showNotification } from '@/utils/notifications';
import { useAuthStore } from '@/stores/authStore';
import { ALL_USERS_CHAT_ROOM_KEY } from '@/api/chat';
import type { ChatMessageEntry } from '@/hooks/useChatRoom';
import type { ChatQuote } from './ChatInput';

const STATUS_META = {
  connecting: { label: '连接中…', color: 'warning' as const },
  open: { label: '在线', color: 'success' as const },
  closed: { label: '已断开', color: 'default' as const },
  error: { label: '连接异常', color: 'error' as const },
};

const NICKNAME_COOKIE = 'chat-nickname';

function getNicknameFromCookie(): string {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${NICKNAME_COOKIE}=([^;]*)`));
    if (match) return decodeURIComponent(match[1]);
  } catch {
    // ignore
  }
  return '';
}

function setNicknameCookie(name: string): void {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${NICKNAME_COOKIE}=${encodeURIComponent(name)}; expires=${expires}; path=/; SameSite=Lax`;
}

function randomGuestName(): string {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `访客${suffix}`;
}

interface ChatRoomPanelProps {
  roomKey: string;
  userName?: string;
  roomName?: string;
  onBack?: () => void;
}

export default function ChatRoomPanel({ roomKey, userName, roomName = '公共聊天房', onBack }: ChatRoomPanelProps) {
  const theme = useTheme();
  const radius = theme.shape.borderRadius;
  const { user } = useAuthStore();
  const isLoggedIn = Boolean(user);

  // 昵称：登录用户用账号名；访客自定义（cookie 持久化）
  const [guestName, setGuestName] = useState(() => getNicknameFromCookie() || randomGuestName());
  const [nameEditable, setNameEditable] = useState(false);
  // 昵称确认中（等待服务端校验回执）时，确认按钮显示加载态并禁用
  const [changingName, setChangingName] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  // 从"＋"菜单发起语音/视频通话时，弹出的"选择通话对象"面板（记录是哪种通话）
  const [callPickerOpen, setCallPickerOpen] = useState(false);
  const [callPickerKind, setCallPickerKind] = useState<CallKind>('audio');
  // 待确认发起的通话（对象 + 类型）；非空时弹出"通话须知"确认弹窗
  const [pendingCall, setPendingCall] = useState<{ name: string; kind: CallKind } | null>(null);
  // 待发送的引用；focusSignal 用于在触发引用时把焦点移到输入框
  const [quote, setQuote] = useState<ChatQuote | null>(null);
  const [focusSignal, setFocusSignal] = useState(0);

  const selfName = isLoggedIn ? userName || user!.username : guestName;
  // 本会话用过的所有名字（含改名前的旧名），用于跨改名校验"哪些消息是我的"
  const [selfNames, setSelfNames] = useState<string[]>(() => [selfName]);
  // 全体聊天房与自定义聊天房（c_*）都需要登录态鉴权（连接时附加 token，供 Pages 校验成员身份）
  const isMembersRoom = roomKey === ALL_USERS_CHAT_ROOM_KEY;
  const isCustomRoom = roomKey.startsWith('c_');

  // 桌面消息提醒开关（通用，适配任意房间）
  const notify = useChatNotifications();
  // 通过 ref 读取最新开关值，避免 handleIncomingMessage 因状态变化而重建触发重连
  const notifyEnabledRef = useRef(notify.enabled);
  useEffect(() => {
    notifyEnabledRef.current = notify.enabled;
  }, [notify.enabled]);

  // 只有"别人的新消息 + 页面失焦(切到其他标签) + 提醒开启"时才弹系统通知
  // 注意：必须在 useChatRoom() 之前声明，否则触发模块初始化 TDZ 报错
  const handleIncomingMessage = useCallback(
    (msg: ChatMessageEntry) => {
      if (!notifyEnabledRef.current || !document.hidden) return;
      showNotification(roomName, `${msg.name || '匿名'}：${msg.content}`);
    },
    [roomName]
  );

  // 语音通话的临时窗口无法在 useChatRoom() 之前拿到 useVoiceCall 的返回值，
  // 用一个 ref 转发器接通二者：onSignal 固定读 ref 里的最新处理器，避免循环依赖。
  const callSignalForwardRef = useRef<(data: Record<string, unknown>) => void>(() => {});
  const handleCallSignal = useCallback((data: Record<string, unknown>) => {
    callSignalForwardRef.current?.(data);
  }, []);

  const { status, connected, error, messages, hasMoreHistory, loadingOlder, loadOlder, sendMessage, sendSignal, sendTyping, typingNames, recallMessage, setNickname, nameRejected, onlineNames } = useChatRoom({
    roomKey,
    userName: selfName,
    auth: isMembersRoom || isCustomRoom,
    onMessage: handleIncomingMessage,
    onSignal: handleCallSignal,
  });
  // 语音通话：复用同一 WebSocket 信令；断开自动结束通话。
  const voiceCall = useVoiceCall({ selfName, sendSignal, connected });
  useEffect(() => {
    callSignalForwardRef.current = voiceCall.handleSignal;
  }, [voiceCall.handleSignal]);

  // 发起通话前先弹"通话须知"确认弹窗；用户点"知道了"才真正发起
  const requestCall = useCallback(
    (name: string, kind: CallKind = 'audio') => {
      if (voiceCall.state !== 'idle') return;
      setCallPickerOpen(false);
      setPendingCall({ name, kind });
    },
    [voiceCall.state]
  );

  // 打开"选择通话对象"面板并记录本次是语音还是视频
  const openPicker = useCallback((kind: CallKind) => {
    setCallPickerKind(kind);
    setCallPickerOpen(true);
  }, []);
  const meta = STATUS_META[status];

  // 自己置顶，其余按加入顺序
  const ordered = [...onlineNames].sort((a, b) => {
    if (a === selfName) return -1;
    if (b === selfName) return 1;
    return 0;
  });

  // 昵称确认改为服务端校验：进入加载态，等回执成功后才切换；被拒则留在编辑态并提示
  const confirmNickname = async () => {
    const trimmed = guestName.trim();
    const final = trimmed || '匿名';
    if (changingName) return;
    setChangingName(true);
    const ok = await setNickname(final);
    setChangingName(false);
    if (ok) {
      // 记录旧名与新名，使改名之前发的消息仍归属"我"，并统一显示为当前名
      setSelfNames((prev) => {
        const next = prev.includes(guestName) ? prev : [...prev, guestName];
        return next.includes(final) ? next : [...next, final];
      });
      setGuestName(final);
      setNicknameCookie(final);
      setNameEditable(false);
    }
    // 失败：不改变当前昵称、不退出编辑态，错误提示由 hook 的 error 横幅展示
  };

  // 入房首条昵称被服务端拒绝（如重名）：自动回到编辑态让用户更换
  useEffect(() => {
    if (!isLoggedIn && nameRejected) setNameEditable(true);
  }, [nameRejected, isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn) setNameEditable(false);
  }, [isLoggedIn]);

  // 右键菜单动作：复制 / 引用 / 撤回
  const handleCopy = (msg: ChatMessageEntry) => {
    navigator.clipboard.writeText(msg.content).catch(() => {});
  };

  const handleQuote = (msg: ChatMessageEntry) => {
    setQuote({ name: msg.name || '匿名', content: msg.content, timestamp: msg.timestamp });
    setFocusSignal((n) => n + 1);
  };

  const handleRecall = (msg: ChatMessageEntry) => {
    if (msg.timestamp) recallMessage(msg.timestamp);
  };

  return (
    <Fade in timeout={400}>
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: `${radius}px`,
          border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.12)}`,
          background: (t) =>
            `linear-gradient(160deg, ${alpha(t.palette.primary.main, 0.05)}, ${alpha(t.palette.secondary.main, 0.03)})`,
        }}
      >
        {/* 访客昵称条：放在公共聊天房最顶部 */}
        {!isLoggedIn && (
          <Box
            sx={{
              px: 2,
              py: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              flexWrap: 'wrap',
              bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
              你的昵称
            </Typography>
            {nameEditable ? (
              <>
                <TextField
                  size="small"
                  value={guestName}
                  autoFocus
                  disabled={changingName}
                  onChange={(e) => setGuestName(e.target.value.slice(0, 20))}
                  sx={{ flex: 1, minWidth: 140, maxWidth: 280 }}
                />
                <Button
                  size="small"
                  variant="contained"
                  onClick={confirmNickname}
                  disabled={changingName}
                  startIcon={changingName ? <CircularProgress size={14} color="inherit" /> : undefined}
                  sx={{ textTransform: 'none' }}
                >
                  {changingName ? '校验中…' : '确认'}
                </Button>
              </>
            ) : (
              <>
                <Typography variant="body1" sx={{ fontWeight: 700 }}>
                  {guestName}
                </Typography>
                <Button size="small" variant="outlined" onClick={() => setNameEditable(true)} sx={{ textTransform: 'none' }}>
                  更换
                </Button>
              </>
            )}
          </Box>
        )}

        {/* 顶栏 */}
        <Box
          sx={{
            px: 2,
            py: 1.25,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            borderBottom: '1px solid',
            borderColor: (t) => alpha(t.palette.divider, 0.8),
            bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
          }}
        >
          {onBack && (
            <IconButton
              size="small"
              onClick={onBack}
              aria-label="返回房间列表"
              sx={{
                mr: 0.5,
                flexShrink: 0,
                color: 'text.secondary',
                bgcolor: (t) => alpha(t.palette.text.primary, 0.04),
                '&:hover': { bgcolor: (t) => alpha(t.palette.text.primary, 0.1) },
              }}
            >
              <ArrowBackIcon sx={{ fontSize: 20 }} />
            </IconButton>
          )}
          {/* 在线入口：放在顶栏最左侧（人数+图标），点击弹出在线成员 */}
          <ButtonBase
            onClick={() => setListOpen(true)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              ml: 0.75,
              mr: 0.5,
              px: 1,
              py: 0.5,
              borderRadius: 1.5,
              flexShrink: 0,
              color: 'text.secondary',
              bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.16 : 0.07),
              '&:hover': {
                bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.3 : 0.15),
              },
            }}
          >
            <Typography variant="caption">在线 {onlineNames.length}</Typography>
            <PeopleIcon fontSize="small" />
          </ButtonBase>
          <ForumIcon color="primary" sx={{ fontSize: 20, flexShrink: 0 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>
            {roomName}
          </Typography>
          {/* 桌面消息提醒开关：放在房间名右侧，仅在浏览器支持时显示 */}
          {notify.supported && (
            <Tooltip
              title={
                notify.permission === 'denied'
                  ? '浏览器通知已被屏蔽，请在浏览器设置中允许本网站通知'
                  : notify.enabled
                  ? '关闭新消息桌面提醒'
                  : '开启新消息桌面提醒（切走页面时收到他人消息会提醒）'
              }
            >
              <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, mr: 0.5 }}>
                {notify.enabled ? (
                  <NotificationsActiveIcon sx={{ fontSize: 18, color: 'primary.main', mr: -0.25 }} />
                ) : (
                  <NotificationsOffIcon sx={{ fontSize: 18, color: 'text.disabled', mr: -0.25 }} />
                )}
                <Switch size="small" checked={notify.enabled} onChange={(_, v) => notify.setEnabled(v)} />
              </Box>
            </Tooltip>
          )}
          <Chip size="small" color={meta.color} label={meta.label} variant="outlined" />
        </Box>

        {/* 错误提示栏 */}
        {error && (
          <Box
            sx={{
              px: 2,
              py: 0.75,
              bgcolor: (t) => alpha(t.palette.error.main, 0.08),
              borderBottom: '1px solid',
              borderColor: (t) => alpha(t.palette.error.main, 0.2),
            }}
          >
            <Typography variant="caption" color="error.main">
              {error}
            </Typography>
          </Box>
        )}

        {/* 消息区 + 输入条 */}
        <ChatMessageList
          messages={messages}
          roomKey={roomKey}
          currentUserName={selfName}
          selfNames={selfNames}
          loading={status === 'connecting' && messages.length === 0}
          hasMoreHistory={hasMoreHistory}
          loadingOlder={loadingOlder}
          onLoadOlder={loadOlder}
          onCopy={handleCopy}
          onQuote={handleQuote}
          onRecall={handleRecall}
        />
        <ChatInput
          disabled={!connected}
          onSend={sendMessage}
          onTyping={sendTyping}
          quote={quote}
          onClearQuote={() => setQuote(null)}
          focusSignal={focusSignal}
          roomKey={roomKey}
          onVoiceCall={() => openPicker('audio')}
          onVideoCall={() => openPicker('video')}
        />

        {/* 对方正在输入…：显示在输入框上方，随对方停止/超时消失 */}
        {typingNames.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.5 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                animation: 'chatTypingPulse 1.2s ease-in-out infinite',
                '@keyframes chatTypingPulse': {
                  '0%, 100%': { opacity: 0.25, transform: 'scale(0.85)' },
                  '50%': { opacity: 1, transform: 'scale(1)' },
                },
              }}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {typingNames.join('、')} 正在输入…
            </Typography>
          </Box>
        )}

        {/* 在线成员：从右侧滑入，向左推 */}
        <SwipeableDrawer
          anchor="right"
          open={listOpen}
          onOpen={() => setListOpen(true)}
          onClose={() => setListOpen(false)}
          PaperProps={{ sx: { width: 300, maxWidth: '85vw', borderRadius: '8px 0 0 8px' } }}
        >
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              在线成员
            </Typography>
            <Chip size="small" color="primary" label={`${onlineNames.length} 人`} variant="outlined" />
          </Box>
          <Divider />
          <List dense disablePadding>
            {ordered.map((name) => {
              const isSelf = name === selfName;
              return (
                <ListItem key={name} sx={{ px: 2, gap: 1 }}>
                  {/* 在线指示点 */}
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      flexShrink: 0,
                      bgcolor: isSelf ? 'primary.main' : 'success.main',
                    }}
                  />
                  <ListItemText
                    primary={name}
                    primaryTypographyProps={{
                      variant: 'body2',
                      fontWeight: isSelf ? 700 : 500,
                      fontFamily: isSelf ? undefined : '"tahoma", "arial", sans-serif',
                    }}
                  />
                  {isSelf && <Chip size="small" label="我" color="primary" variant="filled" sx={{ height: 20 }} />}
                  {!isSelf && (
                    <IconButton
                      size="small"
                      color="primary"
                      title={`与 ${name} 语音通话`}
                      disabled={voiceCall.state !== 'idle'}
                      onClick={() => requestCall(name, 'audio')}
                    >
                      <PhoneIcon fontSize="small" />
                    </IconButton>
                  )}
                </ListItem>
              );
            })}
            {ordered.length === 0 && (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  还没有人加入
                </Typography>
              </Box>
            )}
          </List>
        </SwipeableDrawer>

        {/* 语音/视频通话：发起前弹"通话须知"，说明连接方式与不稳定性 */}
        <Dialog
          open={pendingCall !== null}
          onClose={() => setPendingCall(null)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle sx={{ pb: 1 }}>通话须知</DialogTitle>
          <DialogContent sx={{ px: 1, pb: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
              {`${pendingCall?.kind === 'video' ? '视频通话' : '语音通话'}采用浏览器点对点直连（P2P），由两端直接传输音视频，不经过服务器中转。\n\n这种连接方式取决于双方的网络环境，连接并不保证稳定：\n\n• 受 NAT、防火墙、运营商网络策略等因素影响，可能无法建立连接；\n• 若连接失败或通话中断，不一定是代码问题，可能是你自己的网络环境不支持点对点直连。\n\n对方 ${pendingCall ? `「${pendingCall.name}」` : ''} 接听后即开始连接。`}
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 2, pb: 1.5 }}>
            <Button color="inherit" onClick={() => setPendingCall(null)}>
              取消
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={pendingCall?.kind === 'video' ? <VideocamIcon /> : <PhoneIcon />}
              onClick={() => {
                const call = pendingCall;
                setPendingCall(null);
                if (call) voiceCall.startCall(call.name, call.kind);
              }}
            >
              知道了，开始通话
            </Button>
          </DialogActions>
        </Dialog>

        {/* 语音/视频通话：选择通话对象（从"＋"菜单进入） */}
        <Dialog open={callPickerOpen} onClose={() => setCallPickerOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ pb: 1 }}>
            {callPickerKind === 'video' ? '选择视频通话对象' : '选择语音通话对象'}
          </DialogTitle>
          <DialogContent sx={{ px: 1, pb: 1 }}>
            <List disablePadding>
              {ordered
                .filter((n) => n !== selfName)
                .map((name) => (
                  <ListItem
                    key={name}
                    sx={{ px: 1, gap: 1, borderRadius: 2 }}
                    secondaryAction={
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={callPickerKind === 'video' ? <VideocamIcon /> : <PhoneIcon />}
                        onClick={() => requestCall(name, callPickerKind)}
                        sx={{
                          borderRadius: Math.max(8, theme.shape.borderRadius - 4),
                          textTransform: 'none',
                          minWidth: 92,
                          py: 0.6,
                        }}
                      >
                        通话
                      </Button>
                    }
                  >
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main', flexShrink: 0 }} />
                    <ListItemText primary={name} primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
                  </ListItem>
                ))}
            </List>
            {ordered.length <= 1 && (
              <Box sx={{ py: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  还没有其他人可呼叫
                </Typography>
              </Box>
            )}
          </DialogContent>
        </Dialog>

        {/* 通话浮层 / 来电卡片：按当前通话类型渲染语音或视频卡片 */}
        {voiceCall.kind === 'video' ? (
          <VideoCallCard
            state={voiceCall.state}
            peerName={voiceCall.peerName}
            muted={voiceCall.muted}
            cameraMuted={voiceCall.cameraMuted}
            durationSec={voiceCall.durationSec}
            endedNote={voiceCall.endedNote}
            remoteStream={voiceCall.remoteStream}
            localStream={voiceCall.localStream}
            onAccept={voiceCall.accept}
            onReject={voiceCall.reject}
            onHangup={voiceCall.hangup}
            onToggleMute={voiceCall.toggleMute}
            onToggleCamera={voiceCall.toggleCamera}
          />
        ) : (
          <VoiceCallCard
            state={voiceCall.state}
            peerName={voiceCall.peerName}
            muted={voiceCall.muted}
            durationSec={voiceCall.durationSec}
            endedNote={voiceCall.endedNote}
            remoteStream={voiceCall.remoteStream}
            onAccept={voiceCall.accept}
            onReject={voiceCall.reject}
            onHangup={voiceCall.hangup}
            onToggleMute={voiceCall.toggleMute}
          />
        )}
      </Box>
    </Fade>
  );
}