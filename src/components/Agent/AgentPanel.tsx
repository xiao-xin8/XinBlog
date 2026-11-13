import {
  Box,
  Typography,
  IconButton,
  alpha,
  Chip,
  Tooltip,
  Fade,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CopyAllIcon from '@mui/icons-material/CopyAll';
import { useState } from 'react';
import AgentMessageList from './AgentMessageList';
import AgentInput from './AgentInput';
import type { AgentMessage } from '@/hooks/useAgentChat';
import type { AgentMode } from '@/pages/AgentChat';

const MODES: { value: AgentMode; label: string }[] = [
  { value: 'warm', label: '温柔' },
  { value: 'humorous', label: '幽默' },
  { value: 'professional', label: '专业' },
];

export interface ModelOption {
  id: string;
  name: string;
}

interface AgentPanelProps {
  title: string;
  loading: boolean;
  messages: AgentMessage[];
  mode: AgentMode;
  modelOptions?: ModelOption[];
  selectedModel?: string;
  autoCollapse?: boolean;
  agentAvatar?: string;
  onConfirmAction?: (token: string, approved: boolean) => void | Promise<boolean>;
  onUndoAction?: (undoId: string, token?: string) => Promise<{ ok: boolean; msg?: string }>;
  onModeChange: (mode: AgentMode) => void;
  onModelChange?: (model: string) => void;
  onAutoCollapseChange?: (v: boolean) => void;
  onSend: (text: string) => void;
  onBack: () => void;
}

export default function AgentPanel({
  title,
  loading,
  messages,
  mode,
  modelOptions,
  selectedModel,
  autoCollapse,
  agentAvatar,
  onConfirmAction,
  onUndoAction,
  onModeChange,
  onModelChange,
  onAutoCollapseChange,
  onSend,
  onBack,
}: AgentPanelProps) {
  const theme = useTheme();
  const radius = theme.shape.borderRadius;
  const [copied, setCopied] = useState(false);

  const copyAll = async () => {
    const text = messages
      .filter((m) => m.content)
      .map((m) => `${m.role === 'user' ? '我' : 'AI'}：${m.content}`)
      .join('\n\n');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 剪贴板不可用时静默忽略 */
    }
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
        {/* 顶栏：返回 + 标题 + 状态 */}
        <Box
          sx={{
            px: 2,
            py: 1.25,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexShrink: 0,
            borderBottom: '1px solid',
            borderColor: (t) => alpha(t.palette.divider, 0.8),
            bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
          }}
        >
          <IconButton
            size="small"
            onClick={onBack}
            aria-label="返回对话列表"
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
          <SmartToyIcon color="primary" sx={{ fontSize: 20, flexShrink: 0 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>
            {title}
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={mode}
            onChange={(_, next) => next && onModeChange(next as AgentMode)}
            sx={{
              flexShrink: 0,
              bgcolor: (t) => alpha(t.palette.background.paper, 0.7),
              borderRadius: '999px',
              border: (t) => `1px solid ${alpha(t.palette.divider, 0.8)}`,
              p: 0.25,
              '& .MuiToggleButtonGroup-grouped': {
                mx: 0.25,
                px: 1,
                border: 0,
                borderRadius: '999px !important',
                color: 'text.secondary',
                '&.Mui-selected': {
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.14),
                  color: 'primary.main',
                  fontWeight: 700,
                },
              },
            }}
          >
            {MODES.map((m) => (
              <ToggleButton key={m.value} value={m.value} sx={{ textTransform: 'none', minWidth: 44 }}>
                {m.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          {messages.length > 0 && (
            <Tooltip title={copied ? '已复制' : '复制全部对话'}>
              <IconButton
                size="small"
                onClick={copyAll}
                sx={{ flexShrink: 0, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
              >
                <CopyAllIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          )}
          <Chip
            size="small"
            label={loading ? '思考中' : '在线'}
            color={loading ? 'warning' : 'success'}
            variant="outlined"
          />
        </Box>

        {/* 消息列表 */}
        <AgentMessageList
          messages={messages}
          loading={loading}
          autoCollapse={autoCollapse}
          agentAvatar={agentAvatar}
          onConfirmAction={onConfirmAction}
          onUndoAction={onUndoAction}
        />

        {/* 输入条 */}
        <AgentInput
          disabled={loading}
          onSend={onSend}
          modelOptions={modelOptions}
          selectedModel={selectedModel}
          onModelChange={onModelChange}
          autoCollapse={autoCollapse}
          onAutoCollapseChange={onAutoCollapseChange}
        />
      </Box>
    </Fade>
  );
}