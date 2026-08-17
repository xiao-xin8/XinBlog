import {
  Box,
  Typography,
  Paper,
  Stack,
  Switch,
  FormControlLabel,
  TextField,
  Slider,
  alpha,
  ButtonBase,
  Tooltip,
  Button,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import { MusicNote, QueueMusic } from '@mui/icons-material';
import { useState } from 'react';
import type { MusicEditor } from './useMusicEditor';
import type { MusicPlayMode } from '@/types';
import { PRESET_PLAYLISTS, parsePlaylistId, resolveShortUrl, isValidPlaylistId } from '@/components/MusicPlayer/musicUtils';

const PLAY_MODE_OPTIONS: { value: MusicPlayMode; label: string }[] = [
  { value: 'list', label: '列表循环' },
  { value: 'single', label: '单曲循环' },
  { value: 'random', label: '随机播放' },
];

type SourceMode = 'preset' | 'custom';

export function MusicBasicPanel({ editor }: { editor: MusicEditor }) {
  const {
    enabled,
    setEnabled,
    playlistId,
    setPlaylistId,
    volume,
    setVolume,
    playMode,
    setPlayMode,
    autoplay,
    setAutoplay,
    showLyric,
    setShowLyric,
    memory,
    setMemory,
    position,
    setPosition,
    showInAdmin,
    setShowInAdmin,
    showPage,
    setShowPage,
    imageProxy,
    setImageProxy,
    inputError,
    setInputError,
  } = editor;

  const [sourceMode, setSourceMode] = useState<SourceMode>(playlistId && !PRESET_PLAYLISTS.some(p => p.id === playlistId) ? 'custom' : 'preset');
  const [customInput, setCustomInput] = useState(playlistId && !PRESET_PLAYLISTS.some(p => p.id === playlistId) ? playlistId : '');
  const [resolving, setResolving] = useState(false);

  const playModeIndex = PLAY_MODE_OPTIONS.findIndex((o) => o.value === playMode);
  const hasUrl = /https?:\/\//i.test(customInput);
  const isShortUrl = /163cn\.tv/i.test(customInput);

  const handleResolve = async () => {
    if (!customInput.trim()) return;
    setResolving(true);
    try {
      const parsed = parsePlaylistId(customInput);
      
      if (/163cn\.tv/i.test(parsed)) {
        const resolvedUrl = await resolveShortUrl(customInput);
        if (resolvedUrl) {
          const id = parsePlaylistId(resolvedUrl);
          if (isValidPlaylistId(id)) {
            setPlaylistId(id);
            setCustomInput(id);
            setInputError?.('');
            return;
          }
        }
        
        setInputError?.('无法自动解析短链接，请在浏览器中打开此链接，将页面地址粘贴到此处');
        return;
      }
      if (isValidPlaylistId(parsed)) {
        setPlaylistId(parsed);
        setCustomInput(parsed);
        setInputError?.('');
      } else {
        setInputError?.('无法识别歌单 ID，请检查链接是否正确');
      }
    } finally {
      setResolving(false);
    }
  };

  const handleCustomChange = (value: string) => {
    setCustomInput(value);
    setInputError?.('');
    
    if (/^\d{5,}$/.test(value.trim())) {
      setPlaylistId(value.trim());
    }
  };

  const handlePresetSelect = (id: string) => {
    setPlaylistId(id);
    setCustomInput(id);
    setInputError?.('');
  };

  const sourceModeIndex = sourceMode === 'preset' ? 0 : 1;

  return (
    <Stack spacing={3}>
      {/* 开关 */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: 1, bgcolor: (t) => alpha(t.palette.primary.main, 0.04), border: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              音乐播放器
            </Typography>
          </Box>
          <FormControlLabel
            control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
            label={enabled ? '已开启' : '已关闭'}
          />
        </Stack>
      </Paper>

      {/* 歌单设置 */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <QueueMusic sx={{ color: 'primary.main' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            网易云歌单
          </Typography>
        </Stack>

        {/* 来源选择：预设 / 自定义 */}
        <Box
          sx={{
            position: 'relative',
            display: 'inline-flex',
            minWidth: 'max-content',
            p: 0.5,
            mb: 2.5,
            borderRadius: (t) => t.shape.borderRadius * 1.5,
            bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 4,
              bottom: 4,
              left: 4,
              width: 'calc((100% - 8px) / 2)',
              bgcolor: 'background.paper',
              borderRadius: (t) => t.shape.borderRadius * 1.5,
              boxShadow: (t) => `0 2px 10px ${alpha(t.palette.common.black, 0.08)}`,
              transition: (t) =>
                t.transitions.create('transform', {
                  easing: t.transitions.easing.easeInOut,
                  duration: t.transitions.duration.short,
                }),
              transform: `translateX(${sourceModeIndex * 100}%)`,
            }}
          />
          {(['preset', 'custom'] as const).map((mode) => {
            const active = sourceMode === mode;
            return (
              <ButtonBase
                key={mode}
                onClick={() => setSourceMode(mode)}
                sx={{
                  position: 'relative',
                  zIndex: 1,
                  px: { xs: 2.5, sm: 4 },
                  py: 0.8,
                  borderRadius: (t) => t.shape.borderRadius * 1.5,
                  color: active ? 'primary.main' : 'text.secondary',
                  fontWeight: 600,
                  textTransform: 'none',
                  whiteSpace: 'nowrap',
                  fontSize: '0.875rem',
                  '&:hover': { bgcolor: 'transparent' },
                }}
              >
                {mode === 'preset' ? '预设歌单' : '自定义歌单'}
              </ButtonBase>
            );
          })}
        </Box>

        {sourceMode === 'preset' ? (
          
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 1,
              maxHeight: 280,
              overflowY: 'auto',
              p: 0.5,
            }}
          >
            {PRESET_PLAYLISTS.map((preset) => {
              const active = playlistId === preset.id;
              return (
                <Tooltip key={preset.id} title={preset.desc} placement="top">
                  <ButtonBase
                    onClick={() => handlePresetSelect(preset.id)}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      p: 1.5,
                      borderRadius: 1.5,
                      bgcolor: active ? (t) => alpha(t.palette.primary.main, 0.12) : (t) => alpha(t.palette.primary.main, 0.04),
                      border: '1px solid',
                      borderColor: active ? 'primary.main' : 'divider',
                      transition: (t) =>
                        t.transitions.create(['background-color', 'border-color'], {
                          easing: t.transitions.easing.sharp,
                          duration: t.transitions.duration.shortest,
                        }),
                      '&:hover': {
                        bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                        borderColor: 'primary.main',
                      },
                    }}
                  >
                    <QueueMusic
                      sx={{
                        fontSize: 28,
                        color: active ? 'primary.main' : 'text.secondary',
                        mb: 0.5,
                      }}
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: active ? 700 : 500,
                        color: active ? 'primary.main' : 'text.primary',
                        textAlign: 'center',
                        lineHeight: 1.2,
                        fontSize: '0.8rem',
                      }}
                    >
                      {preset.name}
                    </Typography>
                  </ButtonBase>
                </Tooltip>
              );
            })}
          </Box>
        ) : (
          
          <Stack spacing={1.5}>
            <TextField
              fullWidth
              size="small"
              value={customInput}
              onChange={(e) => handleCustomChange(e.target.value)}
              placeholder="粘贴歌单链接或分享链接"
              error={!!inputError}
              helperText={
                inputError || (
                  <Box component="span">
                    支持：纯数字 ID、网易云链接、163cn.tv 分享短链接
                    <br />
                    获取方法：打开网易云歌单 → 分享 → 复制链接 → 粘贴到此处
                  </Box>
                )
              }
              slotProps={{
                input: {
                  endAdornment: hasUrl ? (
                    <InputAdornment position="end">
                      {isShortUrl ? (
                        <Tooltip title="解析短链接（可能需要几秒钟）">
                          <Button
                            size="small"
                            variant="contained"
                            disabled={resolving}
                            onClick={handleResolve}
                            sx={{ minWidth: 72, fontSize: '0.75rem', py: 0.25 }}
                          >
                            {resolving ? <CircularProgress size={14} /> : '解析'}
                          </Button>
                        </Tooltip>
                      ) : (
                        <Tooltip title="解析链接中的歌单 ID">
                          <Button
                            size="small"
                            variant="contained"
                            onClick={handleResolve}
                            sx={{ minWidth: 72, fontSize: '0.75rem', py: 0.25 }}
                          >
                            解析
                          </Button>
                        </Tooltip>
                      )}
                    </InputAdornment>
                  ) : undefined,
                },
              }}
            />
            {playlistId && isValidPlaylistId(playlistId) && sourceMode === 'custom' && (
              <Typography variant="caption" color="success.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                已识别歌单 ID：{playlistId}
              </Typography>
            )}
          </Stack>
        )}
      </Paper>

      {/* 播放器配置 */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <MusicNote sx={{ color: 'primary.main' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            播放器配置
          </Typography>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          默认音量（{Math.round((isFinite(volume) ? volume : 0) * 100)}%）
        </Typography>
        <Slider
          size="small"
          min={0}
          max={1}
          step={0.01}
          value={isFinite(volume) ? volume : 0}
          onChange={(_, v) => setVolume(v as number)}
          aria-label="默认音量"
          sx={{ maxWidth: 400 }}
        />

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 0.5 }}>
          播放模式
        </Typography>
        <Box
          sx={{
            position: 'relative',
            display: 'inline-flex',
            minWidth: 'max-content',
            p: 0.5,
            borderRadius: (t) => t.shape.borderRadius * 1.5,
            bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 4,
              bottom: 4,
              left: 4,
              width: `calc((100% - 8px) / ${PLAY_MODE_OPTIONS.length})`,
              bgcolor: 'background.paper',
              borderRadius: (t) => t.shape.borderRadius * 1.5,
              boxShadow: (t) => `0 2px 10px ${alpha(t.palette.common.black, 0.08)}`,
              transition: (t) =>
                t.transitions.create('transform', {
                  easing: t.transitions.easing.easeInOut,
                  duration: t.transitions.duration.short,
                }),
              transform: `translateX(${playModeIndex * 100}%)`,
            }}
          />
          {PLAY_MODE_OPTIONS.map((opt) => {
            const active = playMode === opt.value;
            return (
              <ButtonBase
                key={opt.value}
                onClick={() => setPlayMode(opt.value)}
                sx={{
                  position: 'relative',
                  zIndex: 1,
                  px: { xs: 2, sm: 3 },
                  py: 0.8,
                  borderRadius: (t) => t.shape.borderRadius * 1.5,
                  color: active ? 'primary.main' : 'text.secondary',
                  fontWeight: 600,
                  textTransform: 'none',
                  whiteSpace: 'nowrap',
                  fontSize: '0.875rem',
                  '&:hover': { bgcolor: 'transparent' },
                }}
              >
                {opt.label}
              </ButtonBase>
            );
          })}
        </Box>

        {/* 悬浮位置 */}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 0.5 }}>
          悬浮小工具位置
        </Typography>
        <Box
          sx={{
            position: 'relative',
            display: 'inline-flex',
            minWidth: 'max-content',
            p: 0.5,
            borderRadius: (t) => t.shape.borderRadius * 1.5,
            bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 4,
              bottom: 4,
              left: 4,
              width: 'calc((100% - 8px) / 2)',
              bgcolor: 'background.paper',
              borderRadius: (t) => t.shape.borderRadius * 1.5,
              boxShadow: (t) => `0 2px 10px ${alpha(t.palette.common.black, 0.08)}`,
              transition: (t) =>
                t.transitions.create('transform', {
                  easing: t.transitions.easing.easeInOut,
                  duration: t.transitions.duration.short,
                }),
              transform: `translateX(${position === 'left' ? 0 : 100}%)`,
            }}
          />
          {(['left', 'right'] as const).map((pos) => {
            const active = position === pos;
            return (
              <ButtonBase
                key={pos}
                onClick={() => setPosition(pos)}
                sx={{
                  position: 'relative',
                  zIndex: 1,
                  px: { xs: 2, sm: 3 },
                  py: 0.8,
                  borderRadius: (t) => t.shape.borderRadius * 1.5,
                  color: active ? 'primary.main' : 'text.secondary',
                  fontWeight: 600,
                  textTransform: 'none',
                  whiteSpace: 'nowrap',
                  fontSize: '0.875rem',
                  '&:hover': { bgcolor: 'transparent' },
                }}
              >
                贴在{pos === 'left' ? '左侧' : '右侧'}
              </ButtonBase>
            );
          })}
        </Box>

        <Stack spacing={1} sx={{ mt: 2 }}>
          <FormControlLabel
            control={<Switch checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} />}
            label="自动播放（开启后加载完成即开始播放）"
          />
          <FormControlLabel
            control={<Switch checked={showLyric} onChange={(e) => setShowLyric(e.target.checked)} />}
            label="显示歌词"
          />
          <FormControlLabel
            control={<Switch checked={memory} onChange={(e) => setMemory(e.target.checked)} />}
            label="记忆播放（记住上次歌曲、进度与音量）"
          />
          <FormControlLabel
            control={<Switch checked={showInAdmin} onChange={(e) => setShowInAdmin(e.target.checked)} />}
            label="进入管理后台后继续播放"
          />
          <FormControlLabel
            control={<Switch checked={showPage} onChange={(e) => setShowPage(e.target.checked)} />}
            label="启用独立音乐播放页面"
          />
        </Stack>
      </Paper>

      {/* 图片代理设置 */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <MusicNote sx={{ color: 'primary.main' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            图片代理
          </Typography>
        </Stack>

        <Stack spacing={1.5}>
          <FormControlLabel
            control={<Switch checked={imageProxy} onChange={(e) => setImageProxy(e.target.checked)} />}
            label="通过 Cloudflare Worker 中转加载封面图片"
          />
          <Box
            sx={{
              p: 2,
              borderRadius: 1,
              bgcolor: (t) => imageProxy ? alpha(t.palette.warning.main, 0.06) : alpha(t.palette.info.main, 0.06),
              border: '1px solid',
              borderColor: (t) => imageProxy ? alpha(t.palette.warning.main, 0.2) : alpha(t.palette.info.main, 0.15),
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.6 }}>
              {imageProxy ? (
                <>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'warning.main', display: 'block', mb: 0.5 }}>
                    ? 当前已开启中转代理
                  </Typography>
                  <Box component="span" sx={{ display: 'block' }}>
                    <b>好处：</b>封面图片走同域名加载，手机 PWA 顶部不会显示网易云 CDN 地址（如 p1.music.126.net）
                  </Box>
                  <Box component="span" sx={{ display: 'block' }}>
                    <b>缺点：</b>图片加载速度可能变慢（取决于 Cloudflare Worker 响应速度），且消耗 Worker 免费额度
                  </Box>
                </>
              ) : (
                <>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'info.main', display: 'block', mb: 0.5 }}>
                    ? 当前关闭中转代理（默认推荐）
                  </Typography>
                  <Box component="span" sx={{ display: 'block' }}>
                    <b>好处：</b>封面图片直接从网易云 CDN 加载，速度最快，不消耗额外额度
                  </Box>
                  <Box component="span" sx={{ display: 'block' }}>
                    <b>缺点：</b>手机 PWA 顶部可能会显示外部 CDN 地址（如 p1.music.126.net），仅影响美观不影响使用
                  </Box>
                </>
              )}
            </Typography>
          </Box>
        </Stack>
      </Paper>
    </Stack>
  );
}