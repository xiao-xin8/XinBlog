import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box, IconButton, InputBase, Typography, alpha, Select, MenuItem, Tooltip, Switch } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SmartToyIcon from '@mui/icons-material/SmartToy';

const EmojiPicker = lazy(() => import('@/components/Chat/EmojiPicker'));

interface AgentInputProps {
  disabled?: boolean;
  onSend: (text: string) => void;
  modelOptions?: { id: string; name: string }[];
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  autoCollapse?: boolean;
  onAutoCollapseChange?: (v: boolean) => void;
}

export default function AgentInput({ disabled, onSend, modelOptions, selectedModel, onModelChange, autoCollapse, onAutoCollapseChange }: AgentInputProps) {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [activeView, setActiveView] = useState<'menu' | 'emoji'>('menu');
  const [panelHeight, setPanelHeight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!open) {
      setPanelHeight(0);
      return;
    }
    if (!el) return;
    const update = () => setPanelHeight(el.scrollHeight);
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const doSend = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
    setOpen(false);
  };

  const insertEmoji = (emoji: string) => {
    setValue((v) => v + emoji);
    inputRef.current?.focus();
  };

  return (
    <Box
      ref={rootRef}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        px: 1.5,
        py: 1,
        borderTop: '1px solid',
        borderColor: (t) => alpha(t.palette.divider, 0.8),
      }}
    >
      {/* 模型选择行（对齐 dsh-edge composer 的模型选择器） */}
      {modelOptions && modelOptions.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
          <SmartToyIcon sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />
          <Select
            size="small"
            value={selectedModel || ''}
            disabled={disabled}
            onChange={(e) => onModelChange?.(e.target.value)}
            displayEmpty
            renderValue={(v) => {
              const opt = modelOptions.find((o) => o.id === v);
              return opt ? opt.name : '选择模型';
            }}
            sx={{
              minWidth: 150,
              maxWidth: 260,
              height: 26,
              fontSize: '0.78rem',
              borderRadius: 2,
              bgcolor: (t) => alpha(t.palette.text.primary, 0.03),
              '& .MuiOutlinedInput-notchedOutline': {
                border: '1px solid',
                borderColor: (t) => alpha(t.palette.divider, 0.6),
              },
              '& .MuiSelect-select': { py: 0.5, pr: 3.5, display: 'flex', alignItems: 'center' },
            }}
          >
            {modelOptions.map((o) => (
              <MenuItem key={o.id} value={o.id} sx={{ fontSize: '0.8rem' }}>
                <Tooltip title={o.id} placement="right">
                  <Box component="span" sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {o.name || o.id}
                  </Box>
                </Tooltip>
              </MenuItem>
            ))}
          </Select>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.72rem' }}>
            选择本次对话使用的模型
          </Typography>
          {/* 自动折叠思考开关：开启后新生成的深度思考默认折叠、工具参数返回默认不展开 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, ml: 'auto', flexShrink: 0 }}>
            <Switch
              size="small"
              checked={!!autoCollapse}
              disabled={disabled}
              onChange={(e) => onAutoCollapseChange?.(e.target.checked)}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem', userSelect: 'none' }}>
              自动折叠思考
            </Typography>
          </Box>
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
        <InputBase
          inputRef={inputRef}
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          placeholder={disabled ? 'AI 正在回复…' : '给 AI 助手发消息…'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              doSend();
            }
          }}
          multiline
          maxRows={3}
          sx={{
            flex: 1,
            px: 1.5,
            py: 1,
            borderRadius: (t) => `${t.shape.borderRadius}px`,
            bgcolor: (t) => alpha(t.palette.text.primary, 0.02),
            border: '1px solid',
            borderColor: (t) => alpha(t.palette.divider, 0.7),
            transition: 'border-color .2s ease, box-shadow .2s ease, background-color .2s ease',
            fontSize: '0.95rem',
            '&.Mui-focused': {
              borderColor: (t) => t.palette.primary.main,
              boxShadow: (t) => `0 0 0 3px ${alpha(t.palette.primary.main, 0.14)}`,
            },
            '& .MuiInputBase-input': { py: 0 },
          }}
        />
        <IconButton
          color="primary"
          disabled={disabled || !value.trim()}
          onClick={doSend}
          sx={{
            flexShrink: 0,
            bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
            '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.2) },
          }}
        >
          <SendIcon sx={{ fontSize: 22 }} />
        </IconButton>
        <IconButton
          color={open ? 'primary' : 'default'}
          disabled={disabled}
          onClick={() => {
            if (open) setOpen(false);
            else {
              setActiveView('menu');
              setOpen(true);
            }
          }}
          sx={{
            flexShrink: 0,
            transition: 'transform .2s ease',
            transform: open ? 'rotate(45deg)' : 'none',
          }}
        >
          <AddCircleOutlineIcon sx={{ fontSize: 26 }} />
        </IconButton>
      </Box>

      <Box
        sx={{
          mt: 0.5,
          height: panelHeight,
          overflow: 'hidden',
          transition: 'height 300ms cubic-bezier(.4,0,.2,1)',
        }}
      >
        <Box
          ref={innerRef}
          sx={{
            borderRadius: (t) => `${t.shape.borderRadius}px`,
            bgcolor: (t) => alpha(t.palette.text.primary, 0.03),
            border: '1px solid',
            borderColor: (t) => alpha(t.palette.divider, 0.6),
            overflow: 'hidden',
          }}
        >
          {(open || panelHeight > 0) && activeView === 'menu' && (
            <Box sx={{ display: 'flex', gap: 1.5, p: 1.5 }}>
              <Box
                component="button"
                type="button"
                onClick={() => setActiveView('emoji')}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.5,
                  width: 64,
                  py: 1,
                  border: 'none',
                  borderRadius: 2,
                  bgcolor: 'transparent',
                  cursor: 'pointer',
                  '&:hover': (t) => ({ bgcolor: alpha(t.palette.text.primary, 0.06) }),
                }}
              >
                <Box
                  sx={{
                    width: 46,
                    height: 46,
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                    color: 'primary.main',
                  }}
                >
                  <SentimentSatisfiedAltIcon sx={{ fontSize: 28 }} />
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  表情
                </Typography>
              </Box>
            </Box>
          )}

          {(open || panelHeight > 0) && activeView === 'emoji' && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: 0.75, py: 0.5 }}>
                <IconButton size="small" onClick={() => setActiveView('menu')} aria-label="返回菜单">
                  <ArrowBackIcon sx={{ fontSize: 20 }} />
                </IconButton>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  表情
                </Typography>
              </Box>
              <Suspense fallback={<Box sx={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Typography variant="caption" color="text.secondary">加载中…</Typography></Box>}>
                <Box sx={{ p: 0.5 }}>
                  <EmojiPicker onEmoji={insertEmoji} />
                </Box>
              </Suspense>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
