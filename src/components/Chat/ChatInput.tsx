import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box, IconButton, InputBase, Typography, CircularProgress, alpha } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt';
import ImageIcon from '@mui/icons-material/Image';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import VideocamIcon from '@mui/icons-material/Videocam';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { uploadChatImage } from '@/api/chat';

// 表情面板（含全量 emoji 数据）懒加载：首次打开时才加载拆分出的 chunk，避免计入首屏包
const EmojiPicker = lazy(() => import('./EmojiPicker'));

export interface ChatQuote {
  name: string;
  content: string;
  /** 被引用消息的时间戳，用于发送后渲染成可点击、可定位的引用条 */
  timestamp?: number;
}

interface ChatInputProps {
  disabled?: boolean;
  quote?: ChatQuote | null;
  onClearQuote?: () => void;
  onSend: (text: string) => boolean;
  /** 触发引用时自增，用于把焦点带回输入框 */
  focusSignal?: number;
  /** 当前聊天室 key，用于图片上传时关联到对应房间 */
  roomKey: string;
  /** 输入框聚焦且有内容时，按节流回调一次（供"对方正在输入…"广播使用） */
  onTyping?: () => void;
  /** 点击菜单里的"语音通话"时回调（由上层弹出选择通话对象的面板） */
  onVoiceCall?: () => void;
  /** 点击菜单里的"视频通话"时回调（由上层弹出选择通话对象的面板） */
  onVideoCall?: () => void;
}

function truncate(text: string, max: number): string {
  const s = text.replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

// 聊天图片存于聊天 DO。DO 单条 value 上限为 128KB，这里把上传的 base64 压到
// 明显更低的安全阈值，避免超限（Durable Object storage 单值 128KiB）。
const MAX_UPLOAD_BASE64 = 105_000; // base64 长度阈值（留足余量）

/**
 * 用 canvas 把图片尺寸/质量压到阈值以内，返回纯 base64（无 data: 前缀）。
 * 通过「先降质量、再降分辨率」两档循环压缩，至少能压到很小。
 */
async function compressToUploadable(file: File): Promise<{ mime: string; base64: string }> {
  const rawDataUrl = await fileToBase64(file);
  const rawBase64 = rawDataUrl.slice(rawDataUrl.indexOf(',') + 1);
  // 本身就不超限的（小图）：直接原样上传，不牺牲清晰度
  if (rawBase64.length <= MAX_UPLOAD_BASE64) {
    return { mime: file.type, base64: rawBase64 };
  }
  // 无 canvas 环境（理论不会发生）：退回原图
  if (typeof createImageBitmap !== 'function') {
    return file.type.startsWith('image/') ? { mime: file.type, base64: rawBase64 } : { mime: 'image/jpeg', base64: rawBase64 };
  }
  const source = await createImageBitmap(file);
  const MAX_DIM = 1400;
  let width = source.width;
  let height = source.height;
  if (Math.max(width, height) > MAX_DIM) {
    const ratio = MAX_DIM / Math.max(width, height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  let scale = 1;
  let quality = 0.85;
  let base64 = '';
  for (let i = 0; i < 14; i++) {
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    base64 = canvas.toDataURL('image/jpeg', quality).slice('data:image/jpeg;base64,'.length);
    if (base64.length <= MAX_UPLOAD_BASE64) break;
    if (quality > 0.4) {
      quality -= 0.12; // 先降质量
    } else {
      scale *= 0.72; // 质量到底了再降分辨率
      quality = 0.85;
    }
  }
  source.close?.();
  return { mime: 'image/jpeg', base64 };
}

export default function ChatInput({ disabled, quote, onClearQuote, onSend, focusSignal, roomKey, onTyping, onVoiceCall, onVideoCall }: ChatInputProps) {
  const [value, setValue] = useState('');
  // 输入框是否聚焦：仅在聚焦且有内容时广播"正在输入"，失焦即不再发
  const [inputFocused, setInputFocused] = useState(false);
  // 底部"更多选项"面板是否展开
  const [open, setOpen] = useState(false);
  // 面板当前内容：menu 菜单 / emoji 表情（关闭时保留，供下次展开）
  const [activeView, setActiveView] = useState<'menu' | 'emoji'>('menu');
  // 面板高度（px）：由内容真实高度驱动，配合 transition 实现伸缩动画
  const [panelHeight, setPanelHeight] = useState(0);
  const [uploading, setUploading] = useState(false);
  // 上传/选择图片的提示信息（显示在面板内，几秒后自动清除）
  const [postError, setPostError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  // 面板展开时，跟随内容真实高度伸缩；收起时平滑缩回 0。
  // 用 ResizeObserver 监听内容尺寸变化（如菜单→表情切换、表情懒加载完成），高度随之过渡。
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

  // 关闭面板：置为收起（高度过渡到 0），内容保留到收起完成后再隐藏
  const close = () => setOpen(false);

  // 点击面板之外的区域时关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 触发引用动作后，把焦点带回输入框，方便直接键入回复
  useEffect(() => {
    if (focusSignal && focusSignal > 0) inputRef.current?.focus();
  }, [focusSignal]);

  const doSend = () => {
    // 引用：拼成 markdown 引用块。若带原消息时间戳，则写进 cite: 链接里，
    // 发送后渲染成可点击定位的引用条（与正文区隔开）。
    const quoted = quote
      ? quote.timestamp
        ? `> [@${quote.name}：${truncate(quote.content, 100)}](cite:${quote.timestamp})\n\n`
        : `> @${quote.name}：${truncate(quote.content, 100)}\n\n`
      : '';
    const ok = onSend(quoted + value);
    if (ok) {
      setValue('');
      onClearQuote?.();
    }
  };

  const insertEmoji = (emoji: string) => {
    setValue((v) => v + emoji);
    inputRef.current?.focus();
  };

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || uploading) return;
    if (!file.type.startsWith('image/')) {
      showPostError('仅支持图片文件');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showPostError('图片不能超过 5MB');
      return;
    }
    setUploading(true);
    try {
      const { mime, base64 } = await compressToUploadable(file);
      if (base64.length > MAX_UPLOAD_BASE64) {
        showPostError('图片过大，压缩后仍超出限制');
        return;
      }
      const id = await uploadChatImage(roomKey, mime, base64);
      const ok = onSend(`![图片](chat-media://${id})\n`);
      if (ok) close();
    } catch {
      showPostError('发送失败，请稍后重试');
    } finally {
      setUploading(false);
    }
  };

  const showPostError = (msg: string) => {
    setPostError(msg);
    window.setTimeout(() => setPostError((cur) => (cur === msg ? '' : cur)), 3000);
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
      {quote && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 0.75,
            px: 1.25,
            py: 0.75,
            borderRadius: (t) => `${Math.max(4, t.shape.borderRadius - 4)}px`,
            bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
            borderLeft: (t) => `3px solid ${alpha(t.palette.primary.main, 0.5)}`,
          }}
        >
          <Typography
            variant="caption"
            sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'text.secondary' }}
          >
            <Box component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>
              引用
            </Box>
            {' '}@{quote.name}：{quote.content}
          </Typography>
          <IconButton size="small" onClick={() => onClearQuote?.()} aria-label="取消引用" sx={{ flexShrink: 0 }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
        <InputBase
          inputRef={inputRef}
          value={value}
          disabled={disabled}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          onChange={(e) => {
            const next = e.target.value;
            setValue(next);
            // 聚焦且有实际内容时，节流广播"正在输入"（节流在 useChatRoom 内，避免高频）
            if (inputFocused && next.trim()) onTyping?.();
          }}
          placeholder={disabled ? '正在连接聊天室…' : '说点什么…'}
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
            // 聚焦时高亮边框 + 光晕，符合常见聊天输入框的强化反馈
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
        {/* 加号：打开/关闭底部"更多选项"菜单（表情/图片） */}
        <IconButton
          color={open ? 'primary' : 'default'}
          disabled={disabled}
          onClick={() => {
            if (open) close();
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

      {/* 底部更多选项面板：外层按 panelHeight 做高度伸缩过渡，随面板展开/收起，输入条同步平滑上移/下移 */}
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
        {/* 上传/选择提示 */}
        {postError && (
          <Typography
            variant="caption"
            sx={{ display: 'block', px: 1.5, pt: 1, color: 'warning.main' }}
          >
            {postError}
          </Typography>
        )}

        {/* 菜单：功能入口（表情 / 图片） */}
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
              {/* 图片：用 label 包裹文件输入，靠原生 label 激活弹出选择器（安卓/iOS 均兼容） */}
              <Box
                component="label"
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.5,
                  width: 64,
                  py: 1,
                  borderRadius: 2,
                  cursor: uploading ? 'wait' : 'pointer',
                  pointerEvents: uploading ? 'none' : 'auto',
                  opacity: uploading ? 0.6 : 1,
                  '&:hover': (t) => ({ bgcolor: alpha(t.palette.text.primary, 0.06) }),
                }}
              >
                <input type="file" accept="image/*" onChange={handleImageFile} tabIndex={-1} style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }} />
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
                  {uploading ? <CircularProgress size={22} /> : <ImageIcon sx={{ fontSize: 28 }} />}
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  图片
                </Typography>
              </Box>
              {/* 语音通话：点击后交给上层弹出"选择通话对象"，并收起菜单 */}
              <Box
                component="button"
                type="button"
                onClick={() => {
                  close();
                  onVoiceCall?.();
                }}
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
                    bgcolor: (t) => alpha(t.palette.secondary.main, 0.14),
                    color: 'secondary.main',
                  }}
                >
                  <PhoneInTalkIcon sx={{ fontSize: 28 }} />
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  语音通话
                </Typography>
              </Box>
              {/* 视频通话：点击后交给上层弹出"选择通话对象"，并收起菜单 */}
              <Box
                component="button"
                type="button"
                onClick={() => {
                  close();
                  onVideoCall?.();
                }}
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
                    bgcolor: (t) => alpha(t.palette.success.main, 0.14),
                    color: 'success.main',
                  }}
                >
                  <VideocamIcon sx={{ fontSize: 28 }} />
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  视频通话
                </Typography>
              </Box>
            </Box>
          )}

          {/* 表情分类选择 */}
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
              <Suspense fallback={<Box sx={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress size={28} /></Box>}>
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