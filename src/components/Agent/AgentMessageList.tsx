import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Avatar,
  alpha,
  CircularProgress,
  keyframes,
  Collapse,
  Fade,
  IconButton,
  Button,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import PsychologyIcon from '@mui/icons-material/Psychology';
import HandymanIcon from '@mui/icons-material/Handyman';
import CheckIcon from '@mui/icons-material/Check';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CloseIcon from '@mui/icons-material/Close';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import UndoIcon from '@mui/icons-material/Undo';
import AgentMessageContent from './AgentMessageContent';
import { getChatBubbleRenderer } from '@/themes/chatBubble/renderers';
import { ConfirmDialog } from '@/components/Common/ConfirmDialog';
import { useSiteStore } from '@/stores/siteStore';
import { useAuthStore } from '@/stores/authStore';
import type { AgentMessage, AgentStep, AgentConfirmAction } from '@/hooks/useAgentChat';

// 步骤卡片的温和入场动画
const stepIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
`;

/* 参数 / 返回结果的小型等宽预览块 */
function CodePreview({ label, text }: { label: string; text: string }) {
  return (
    <Box
      sx={{
        px: 1,
        py: 0.5,
        borderRadius: 0.75,
        bgcolor: (t) => alpha(t.palette.common.black, 0.04),
        border: (t) => `1px solid ${alpha(t.palette.divider, 0.3)}`,
        fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
        fontSize: '0.7rem',
        lineHeight: 1.5,
        color: 'text.secondary',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        userSelect: 'text',
      }}
    >
      <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', fontSize: '0.65rem', mb: 0.2 }}>
        {label}
      </Typography>
      {text}
    </Box>
  );
}

/* 整条 AI 回复的段序列：思考 / 工具调用 / 写操作确认 / 普通回复 全部串在一个气泡里，用线点线连接 */
function SegmentFlow({
  steps,
  busy,
  autoCollapse,
  action,
  onConfirmAction,
  onUndoAction,
}: {
  steps: AgentStep[];
  busy: boolean;
  autoCollapse?: boolean;
  action?: AgentConfirmAction;
  onConfirmAction?: (token: string, approved: boolean) => void | Promise<boolean>;
  onUndoAction?: (undoId: string, token?: string) => Promise<{ ok: boolean; msg?: string }>;
}) {
  const running = busy || steps.some((s) => s.kind === 'tool' && s.status === 'running');
  void running;
  // 写操作确认/结果作为一条 action 段串进流程流（内嵌消息，对话不截断）
  const allSteps: AgentStep[] = action
    ? [...steps, { kind: 'action', id: `act-${action.token}`, action }]
    : steps;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {allSteps.map((s, i) => (
        <SegmentRow
          key={s.id}
          step={s}
          isLast={i === allSteps.length - 1}
          autoCollapse={autoCollapse}
          onConfirmAction={onConfirmAction}
          onUndoAction={onUndoAction}
        />
      ))}
    </Box>
  );
}

/* 单条段：普通回复（白）/ 深度思考（灰，可折叠）/ 工具调用（主题色，可折叠）/ 写操作确认（横条），带左线点线 */
function SegmentRow({
  step,
  isLast,
  autoCollapse,
  onConfirmAction,
  onUndoAction,
}: {
  step: AgentStep;
  isLast: boolean;
  autoCollapse?: boolean;
  onConfirmAction?: (token: string, approved: boolean) => void | Promise<boolean>;
  onUndoAction?: (undoId: string, token?: string) => Promise<{ ok: boolean; msg?: string }>;
}) {
  // 开启「自动折叠」时：新生成的思考/工具段默认收起（只显示标题，参数/返回默认不展开）
  const [open, setOpen] = useState(() => !autoCollapse);
  const running = step.status === 'running';
  const hasDetail = !!(step.params || step.output);
  const isThink = step.kind === 'think';
  const isTool = step.kind === 'tool';
  const isContent = step.kind === 'content';
  const isAction = step.kind === 'action';

  return (
    <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 0.75, px: 1, py: 0.4 }}>
      {/* 左线点线 */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 14, flexShrink: 0, pt: 0.9 }}>
        <Box
          sx={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            flexShrink: 0,
            bgcolor: isTool ? 'primary.main' : isThink ? (t) => t.palette.text.disabled : isAction ? 'warning.main' : 'success.main',
            border: (t) =>
              `1px solid ${alpha(isTool ? t.palette.primary.main : isThink ? t.palette.text.disabled : isAction ? t.palette.warning.main : t.palette.success.main, 0.4)}`,
          }}
        />
        {!isLast && (
          <Box sx={{ width: 2, flex: 1, minHeight: 8, bgcolor: (t) => alpha(t.palette.text.primary, 0.12), borderRadius: 1 }} />
        )}
      </Box>

      {/* 内容 */}
      <Box sx={{ minWidth: 0, flex: 1, pb: 0.25 }}>
        {isAction && step.action ? (
          <ActionCardStep action={step.action} onConfirmAction={onConfirmAction} onUndoAction={onUndoAction} />
        ) : isContent ? (
          /* 普通回复：白色气泡 */
          <Box
            sx={{
              px: 1.5,
              py: 1,
              borderRadius: 1.25,
              bgcolor: (t) => alpha(t.palette.background.paper, 0.9),
              border: (t) => `1px solid ${alpha(t.palette.divider, 0.25)}`,
              wordBreak: 'break-word',
              animation: `${stepIn} 0.3s ease`,
            }}
          >
            {step.text ? (
              <AgentMessageContent content={step.text} />
            ) : (
              <CircularProgress size={14} sx={{ display: 'block' }} />
            )}
          </Box>
        ) : isThink ? (
          /* 深度思考：灰色、可折叠 */
          <Box
            sx={{
              border: (t) => `1px solid ${alpha(t.palette.divider, 0.3)}`,
              borderRadius: 1.25,
              bgcolor: (t) => alpha(t.palette.text.primary, 0.045),
              overflow: 'hidden',
              animation: `${stepIn} 0.3s ease`,
            }}
          >
            <Box
              component="button"
              onClick={() => setOpen((v) => !v)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.6,
                width: '100%',
                border: 0,
                bgcolor: 'transparent',
                p: 0,
                px: 1.25,
                py: 0.6,
                cursor: 'pointer',
                textAlign: 'left',
                color: 'text.secondary',
                '&:hover': { bgcolor: (t) => alpha(t.palette.text.primary, 0.04) },
              }}
            >
              <PsychologyIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.72rem' }}>
                深度思考
              </Typography>
              <ExpandMoreIcon
                sx={{
                  ml: 'auto',
                  fontSize: 16,
                  color: 'text.disabled',
                  transition: 'transform .2s ease',
                  transform: open ? 'rotate(180deg)' : 'none',
                }}
              />
            </Box>
            <Collapse in={open} timeout={220}>
              <Box sx={{ px: 1.25, pb: 1 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    lineHeight: 1.6,
                    display: 'block',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {step.text}
                </Typography>
              </Box>
            </Collapse>
          </Box>
        ) : (
          /* 工具调用：主题色、可折叠 */
          <Box
            sx={{
              border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.35)}`,
              borderRadius: 1.25,
              bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
              overflow: 'hidden',
              animation: `${stepIn} 0.3s ease`,
            }}
          >
            <Box
              component="button"
              onClick={() => running || setOpen((v) => !v)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.6,
                flexWrap: 'wrap',
                width: '100%',
                border: 0,
                bgcolor: 'transparent',
                p: 0,
                px: 1.25,
                py: 0.6,
                textAlign: 'left',
                cursor: running ? 'default' : 'pointer',
                borderRadius: 0.75,
                '&:hover': running ? undefined : { bgcolor: (t) => alpha(t.palette.primary.main, 0.08) },
              }}
            >
              {running ? (
                <CircularProgress size={13} thickness={5} sx={{ color: 'primary.main', flexShrink: 0 }} />
              ) : step.status === 'error' ? (
                <ErrorOutlineIcon sx={{ fontSize: 15, color: 'error.main', flexShrink: 0 }} />
              ) : (
                <CheckIcon sx={{ fontSize: 15, color: 'success.main', flexShrink: 0 }} />
              )}
              <HandymanIcon sx={{ fontSize: 13, color: 'primary.main', flexShrink: 0 }} />
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {step.name}
              </Typography>
              {step.summary && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  · {step.summary}
                </Typography>
              )}
              {hasDetail && !running && (
                <ExpandMoreIcon
                  sx={{
                    ml: 'auto',
                    fontSize: 15,
                    color: 'text.disabled',
                    transition: 'transform .2s ease',
                    transform: open ? 'rotate(180deg)' : 'none',
                  }}
                />
              )}
            </Box>
            {hasDetail && (
              <Collapse in={open} timeout={200}>
                <Box sx={{ px: 1.25, pb: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                  {step.params && <CodePreview label="参数" text={step.params} />}
                  {step.output && <CodePreview label="返回" text={step.output} />}
                </Box>
              </Collapse>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

interface AgentMessageListProps {
  messages: AgentMessage[];
  loading?: boolean;
  /** 开启时：新生成的深度思考默认折叠、工具参数/返回默认不展开 */
  autoCollapse?: boolean;
  /** AI 智能体头像（后台设置，留空用默认机器人图标） */
  agentAvatar?: string;
  /** 确认/取消写操作（AI 挂起等待，同一流继续） */
  onConfirmAction?: (token: string, approved: boolean) => void | Promise<boolean>;
  /** 回滚已执行的写操作 */
  onUndoAction?: (undoId: string, token?: string) => Promise<{ ok: boolean; msg?: string }>;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

// 写操作确认/结果段：横条卡片，串在流程流里。操作前=确认/取消，执行后=结果+回滚，整条可点击展开细节
function ActionCardStep({
  action,
  onConfirmAction,
  onUndoAction,
}: {
  action: AgentConfirmAction;
  onConfirmAction?: (token: string, approved: boolean) => void | Promise<boolean>;
  onUndoAction?: (undoId: string, token?: string) => Promise<{ ok: boolean; msg?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [undoConfirmOpen, setUndoConfirmOpen] = useState(false);
  const status = action.status;
  const isWaiting = status === 'waiting';
  const isDone = status === 'done';
  const isFailed = status === 'failed';
  const isRejected = status === 'rejected';
  const isRolledBack = status === 'rolled_back';
  const disabled = isRejected || isRolledBack || isFailed;
  const doing = status === 'resolved' || status === 'rolling_back' || rolling;

  const title = isDone
    ? '操作已完成'
    : isFailed
      ? '操作执行失败'
      : isRejected
        ? '该操作已取消'
        : isRolledBack
          ? '已回滚'
          : doing
            ? '正在执行…'
            : '需要你确认的操作';

  return (
    <Box
      onClick={() => {
        if (!doing && !disabled) setOpen((v) => !v);
      }}
      sx={{
        border: (t) =>
          `1px solid ${
            disabled
              ? isFailed
                ? alpha(t.palette.error.main, 0.5)
                : alpha(t.palette.text.disabled, 0.3)
              : isDone
                ? alpha(t.palette.success.main, 0.45)
                : alpha(t.palette.warning.main, 0.5)
          }`,
        borderRadius: 1.25,
        bgcolor: (t) =>
          disabled
            ? isFailed
              ? alpha(t.palette.error.main, 0.07)
              : alpha(t.palette.text.disabled, 0.04)
            : isDone
              ? alpha(t.palette.success.main, 0.05)
              : alpha(t.palette.warning.main, 0.07),
        overflow: 'hidden',
        cursor: doing || disabled ? 'default' : 'pointer',
        animation: `${stepIn} 0.3s ease`,
      }}
    >
      {/* 标题行 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, px: 1.25, py: 0.6 }}>
        {doing ? (
          <CircularProgress size={14} thickness={5} sx={{ color: 'warning.main', flexShrink: 0 }} />
        ) : isDone ? (
          <CheckIcon sx={{ fontSize: 15, color: 'success.main', flexShrink: 0 }} />
        ) : isFailed ? (
          <ErrorOutlineIcon sx={{ fontSize: 15, color: 'error.main', flexShrink: 0 }} />
        ) : disabled ? (
          <CloseIcon sx={{ fontSize: 15, color: 'text.disabled', flexShrink: 0 }} />
        ) : (
          <PriorityHighIcon sx={{ fontSize: 15, color: 'warning.main', flexShrink: 0 }} />
        )}
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            fontSize: '0.75rem',
            color: isDone ? 'success.main' : isFailed ? 'error.main' : disabled ? 'text.disabled' : 'warning.main',
          }}
        >
          {title}
        </Typography>
        {!doing && !disabled && (
          <ExpandMoreIcon
            sx={{
              ml: 'auto',
              fontSize: 16,
              color: 'text.disabled',
              transition: 'transform .2s ease',
              transform: open ? 'rotate(180deg)' : 'none',
            }}
          />
        )}
      </Box>

      {/* 文字行：操作说明 / 执行结果 / 失败原因（一条一条排下来） */}
      <Box sx={{ px: 1.25, py: 0.25 }}>
        <Typography
          variant="body2"
          sx={{
            fontSize: '0.82rem',
            color: isFailed ? 'error.main' : disabled ? 'text.disabled' : 'text.primary',
            wordBreak: 'break-word',
          }}
        >
          {isDone && action.message ? action.message : isFailed && action.message ? action.message : `我准备执行：${action.target}`}
        </Typography>
      </Box>

      {/* 按钮行：右下角（取消/确认 或 回滚），点击按钮不触发展开/收起 */}
      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{ px: 1.25, pb: 1, pt: 0.25, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
      >
        {isWaiting && (
          <>
            <Button
              size="small"
              color="error"
              variant="outlined"
              startIcon={<CloseIcon fontSize="small" />}
              onClick={() => onConfirmAction?.(action.token, false)}
              sx={{ textTransform: 'none', borderRadius: 1.5 }}
            >
              取消
            </Button>
            <Button
              size="small"
              color="primary"
              variant="contained"
              startIcon={<CheckIcon fontSize="small" />}
              onClick={() => onConfirmAction?.(action.token, true)}
              sx={{ textTransform: 'none', borderRadius: 1.5 }}
            >
              确认执行
            </Button>
          </>
        )}
        {isDone && action.undoId && (
          <Button
            size="small"
            color="primary"
            variant="outlined"
            startIcon={rolling ? <CircularProgress size={12} /> : <UndoIcon fontSize="small" />}
            disabled={rolling}
            onClick={() => setUndoConfirmOpen(true)}
            sx={{ textTransform: 'none', borderRadius: 1.5 }}
          >
            回滚
          </Button>
        )}
      </Box>

      {/* 展开区：等待时=操作参数；完成后=回滚预览 */}
      <Collapse in={open} timeout={200}>
        <Box
          sx={{
            px: 1.25,
            pb: 1,
            pt: 0.75,
            borderTop: (t) => `1px dashed ${alpha(t.palette.divider, 0.6)}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
          }}
        >
          {isWaiting && action.params && <CodePreview label="操作参数" text={action.params} />}
          {isDone && (
            <>
              {action.undoPreview && (
                <Box sx={{ display: 'flex', gap: 0.6, alignItems: 'flex-start' }}>
                  <UndoIcon sx={{ fontSize: 13, color: 'text.secondary', mt: 0.2, flexShrink: 0 }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
                    {action.undoPreview}
                  </Typography>
                </Box>
              )}
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                操作后 24 小时内可回滚
              </Typography>
            </>
          )}
          {disabled && isRolledBack && (
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              该操作已回滚，无法再次回滚
            </Typography>
          )}
        </Box>
      </Collapse>

      {/* 回滚确认弹窗：防止手快误点 */}
      <ConfirmDialog
        open={undoConfirmOpen}
        title="确认回滚操作"
        content={
          <>
            确定要回滚「{action.target}」吗？
            {action.undoPreview && (
              <Box component="span" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                {action.undoPreview}
              </Box>
            )}
            <Box component="span" sx={{ display: 'block', mt: 0.5, color: 'text.disabled' }}>
              回滚后该操作将恢复到操作前状态，且仅可执行一次。
            </Box>
          </>
        }
        confirmText="确认回滚"
        confirmColor="primary"
        loading={rolling}
        onClose={() => setUndoConfirmOpen(false)}
        onConfirm={async () => {
          setUndoConfirmOpen(false);
          setRolling(true);
          try {
            await onUndoAction?.(action.undoId!, action.token);
          } finally {
            setRolling(false);
          }
        }}
      />
    </Box>
  );
}

export default function AgentMessageList({ messages, loading, autoCollapse, agentAvatar, onConfirmAction, onUndoAction }: AgentMessageListProps) {
  const theme = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  const radius = theme.shape.borderRadius;
  // 当前登录用户（导航栏头像同源），用于展示用户消息的头像
  const authUser = useAuthStore((s) => s.user);

  // 复用站点聊天气泡主题
  const site = useSiteStore();
  const bubbleTheme = site.config.chatBubbleTheme || { variant: 'default' };
  const bubbleRenderer = getChatBubbleRenderer(bubbleTheme.variant);
  const bubbleStyles = useMemo(() => {
    if (!bubbleRenderer) return null;
    const params = { ...bubbleRenderer.defaultParams, ...(bubbleTheme.params || {}) };
    return bubbleRenderer.render(params, {
      themeColor: theme.palette.primary.main,
      borderRadius: theme.shape.borderRadius ?? 16,
    });
  }, [bubbleRenderer, bubbleTheme.params, theme.palette.primary.main, theme.shape.borderRadius]);

  // 是否贴底：贴底时新内容自动跟随到底部；用户上翻后自动暂停，回到底部附近后恢复
  const [stickToBottom, setStickToBottom] = useState(true);

  // 滚动监听：距底 < 120px 视为贴底
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setStickToBottom(distance < 120);
  };

  // 内容/流式变化时：仅当用户仍贴底才自动滚到底部。
  // 修复：之前每次 messages/loading 变化都无条件 scrollTop=scrollHeight，
  // 导致 AI 回答流式期间把用户死死钉在底部、根本无法上翻看历史。
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom) el.scrollTop = el.scrollHeight;
  }, [messages, loading, stickToBottom]);

  // 用户上翻离开底部后，点击按钮快速回到最新位置
  const jumpToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setStickToBottom(true);
  };

  return (
    <Box sx={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Box
        ref={scrollRef}
        onScroll={handleScroll}
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          px: { xs: 1, sm: 2 },
          py: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: (t) => alpha(t.palette.text.primary, 0.15),
            borderRadius: 2,
          },
        }}
      >
      {messages.length === 0 && !loading && (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            color: 'text.secondary',
          }}
        >
          <SmartToyIcon sx={{ fontSize: 48, opacity: 0.3 }} />
          <Typography variant="body2" color="text.secondary">
            向 AI 助手提问，开始对话吧
          </Typography>
        </Box>
      )}

      {messages.map((msg) => {
        const isUser = msg.role === 'user';
        return (
          <Box
            key={msg.id}
            sx={{
              display: 'flex',
              flexDirection: isUser ? 'row-reverse' : 'row',
              gap: 1,
              alignItems: 'flex-start',
            }}
          >
            {/* 头像：用户=当前登录用户（与导航栏同源）；AI=后台设置的智能体头像，留空用机器人图标 */}
            {isUser ? (
              <Avatar
                src={authUser?.avatar || undefined}
                sx={{
                  width: 36,
                  height: 36,
                  flexShrink: 0,
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.15),
                  color: 'primary.main',
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {authUser?.username ? authUser.username.charAt(0).toUpperCase() : <PersonIcon sx={{ fontSize: 20 }} />}
              </Avatar>
            ) : (
              <Avatar
                src={agentAvatar || undefined}
                sx={{
                  width: 36,
                  height: 36,
                  flexShrink: 0,
                  bgcolor: (t) => alpha(t.palette.secondary.main, 0.15),
                  color: 'secondary.main',
                }}
              >
                <SmartToyIcon sx={{ fontSize: 20 }} />
              </Avatar>
            )}

            {/* 气泡 + 时间 */}
            <Box sx={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Box
                sx={{
                  borderRadius: `${radius}px`,
                  wordBreak: 'break-word',
                  fontSize: '0.95rem',
                  lineHeight: 1.6,
                  // 应用气泡主题样式（自己 = user，对方 = assistant）
                  ...(bubbleRenderer
                    ? (isUser ? bubbleStyles?.mine : bubbleStyles?.other) ?? {}
                    : {}),
                  // 默认气泡配色（无主题时）
                  ...(!bubbleRenderer && {
                    bgcolor: isUser
                      ? (t) => alpha(t.palette.primary.main, 0.12)
                      : (t) => alpha(t.palette.background.paper, 0.9),
                    border: (t) => `1px solid ${alpha(t.palette.divider, 0.3)}`,
                    ...(isUser
                      ? { borderTopRightRadius: Math.max(2, radius * 0.2) }
                      : { borderTopLeftRadius: Math.max(2, radius * 0.2) }),
                  }),
                }}
              >
                {!isUser && (msg.steps?.length || msg.action) ? (
                  /* AI 整条回复：思考/工具/写操作确认/普通回复 全部串在一个气泡里 */
                  <SegmentFlow
                    steps={msg.steps || []}
                    busy={!!loading}
                    autoCollapse={autoCollapse}
                    action={msg.action}
                    onConfirmAction={onConfirmAction}
                    onUndoAction={onUndoAction}
                  />
                ) : msg.content ? (
                  <Box sx={{ px: 1.5, py: 1 }}>
                    <AgentMessageContent content={msg.content} />
                  </Box>
                ) : (
                  <Box sx={{ p: 1.5 }}>
                    <CircularProgress size={16} sx={{ display: 'block' }} />
                  </Box>
                )}
              </Box>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.disabled',
                  textAlign: isUser ? 'right' : 'left',
                  fontSize: '0.7rem',
                  px: 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  flexWrap: 'wrap',
                }}
              >
                {formatTime(msg.timestamp)}
                {!isUser && (!!msg.rounds || Number(msg.usage?.total) > 0) && (
                  <Box component="span" sx={{ color: 'text.disabled' }}>
                    · 调用 {msg.rounds ?? 0} 轮 · {msg.usage?.total ?? 0} tokens
                  </Box>
                )}
              </Typography>
            </Box>
          </Box>
        );
      })}
      </Box>

      {/* 用户上翻离开底部后，提供快速回到最新的按钮（仅箭头，Fade 显隐动画） */}
      <Fade in={!stickToBottom && messages.length > 0}>
        <IconButton
          size="small"
          color="primary"
          onClick={jumpToBottom}
          title="回到底部"
          sx={{
            position: 'absolute',
            bottom: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2,
            bgcolor: (t) => alpha(t.palette.background.paper, 0.95),
            border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.3)}`,
            boxShadow: 3,
            '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.1) },
          }}
        >
          <ArrowDownwardIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Fade>
    </Box>
  );
}
