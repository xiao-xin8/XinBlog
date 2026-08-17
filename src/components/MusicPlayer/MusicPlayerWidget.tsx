import { Box, Typography, IconButton, Slider, alpha, Tooltip } from '@mui/material';
import {
  PlayArrow,
  Pause,
  SkipPrevious,
  SkipNext,
  MusicNote,
  VolumeUp,
  VolumeDown,
  VolumeOff,
  Repeat,
  RepeatOne,
  Shuffle,
  QueueMusic,
  ChevronLeft,
  ChevronRight,
} from '@mui/icons-material';
import { useEffect, useRef, useState } from 'react';
import { formatTime, getProxyImageUrl } from './musicUtils';
import type { MusicPlayerApi } from './useMusicPlayer';

interface MusicPlayerWidgetProps {
  player: MusicPlayerApi;
  position: 'left' | 'right';
  
  defaultExpanded?: boolean;
  
  disableScrollIntercept?: boolean;
  
  showLyric?: boolean;
}

const MODE_ICONS: Record<string, React.ReactNode> = {
  list: <Repeat fontSize="small" />,
  single: <RepeatOne fontSize="small" />,
  random: <Shuffle fontSize="small" />,
};


const PANEL_WIDTH = 300;

const TAB_WIDTH = 20;

const PLAYLIST_MAX_HEIGHT = 320;







export function MusicPlayerWidget({ player, position, defaultExpanded = false, disableScrollIntercept = false, showLyric = true }: MusicPlayerWidgetProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const {
    isPlaying,
    loading,
    currentTime,
    duration,
    volume,
    isMuted,
    playMode,
    playlist,
    lyrics,
    currentLyricIndex,
    currentSong,
    togglePlay,
    playAt,
    prev,
    next,
    setProgress,
    toggleMute,
    togglePlayMode,
  } = player;

  const isLeft = position === 'left';
  const progressPercent = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  
  useEffect(() => {
    if (disableScrollIntercept) return;
    const panel = panelRef.current;
    const list = listRef.current;
    if (!panel || !list) return;
    const onWheel = (e: WheelEvent) => {
      if (list.contains(e.target as Node)) {
        const scrollable = list.scrollHeight > list.clientHeight;
        if (!scrollable) {
          e.preventDefault();
        } else {
          const atTop = list.scrollTop <= 0;
          const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
          const reachingEdge = (e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom);
          if (reachingEdge) e.preventDefault();
        }
      } else {
        e.preventDefault();
      }
      e.stopPropagation();
    };
    panel.addEventListener('wheel', onWheel, { passive: false });
    return () => panel.removeEventListener('wheel', onWheel);
  }, [expanded, showPlaylist, disableScrollIntercept]);

  
  const collapsedTranslate = isLeft
    ? `translateX(calc(-100% + ${TAB_WIDTH}px))`
    : `translateX(calc(100% - ${TAB_WIDTH}px))`;

  return (
    <Box
      ref={panelRef}
      sx={{
        position: 'fixed',
        [isLeft ? 'left' : 'right']: 0,
        bottom: '2em',
        zIndex: (t) => t.zIndex.drawer + 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: isLeft ? 'flex-start' : 'flex-end',
        transform: expanded ? 'translateX(0)' : collapsedTranslate,
        transition: (t) =>
          t.transitions.create('transform', {
            easing: t.transitions.easing.easeInOut,
            duration: 500,
          }),
      }}
    >
      {/* 切换条 + 主卡片（同行） */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: isLeft ? 'row-reverse' : 'row',
          alignItems: 'stretch',
        }}
      >
        {/* 切换条（收起时贴屏幕边缘，点击展开/收起） */}
        <Tooltip title={expanded ? '收起播放器' : '展开播放器'} placement={isLeft ? 'right' : 'left'}>
          <Box
            onClick={() => {
              setExpanded((s) => !s);
              if (expanded) setShowPlaylist(false);
            }}
            sx={{
              width: TAB_WIDTH,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              bgcolor: (t) => alpha(t.palette.primary.main, 0.6),
              ...(isLeft
                ? { borderTopRightRadius: 1, borderBottomRightRadius: 1 }
                : { borderTopLeftRadius: 1, borderBottomLeftRadius: 1 }),
              transition: (t) =>
                t.transitions.create('background-color', {
                  easing: t.transitions.easing.sharp,
                  duration: t.transitions.duration.shortest,
                }),
              '&:hover': {
                bgcolor: 'primary.main',
              },
            }}
          >
            {/* 收起=向外箭头，展开=向内箭头；播放中显示喇叭更明显 */}
            <IconButton size="small" sx={{ p: 0, color: 'primary.contrastText' }}>
              {isPlaying ? (
                <VolumeUp fontSize="small" />
              ) : expanded ? (
                isLeft ? (
                  <ChevronLeft fontSize="small" />
                ) : (
                  <ChevronRight fontSize="small" />
                )
              ) : isLeft ? (
                <ChevronRight fontSize="small" />
              ) : (
                <ChevronLeft fontSize="small" />
              )}
            </IconButton>
          </Box>
        </Tooltip>

        {/* 主卡片 */}
        <Box
          sx={{
            width: PANEL_WIDTH,
            maxWidth: 'calc(100vw - 60px)',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            ...(isLeft
              ? { borderTopRightRadius: 1, borderBottomRightRadius: 1 }
              : { borderTopLeftRadius: 1, borderBottomLeftRadius: 1 }),
            boxShadow: (t) =>
              t.palette.mode === 'light'
                ? `0 8px 40px ${alpha(t.palette.primary.main, 0.15)}`
                : `0 8px 40px ${alpha(t.palette.common.black, 0.4)}`,
          }}
        >
          {/* 顶部：封面 + 歌曲信息 + 控制 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 1.25, pb: 0.75 }}>
            {/* 圆形旋转封面 */}
            <Box
              sx={{
                width: 68,
                height: 68,
                borderRadius: '50%',
                overflow: 'hidden',
                flexShrink: 0,
                border: '2px solid',
                borderColor: (t) => alpha(t.palette.primary.main, 0.35),
                animation: isPlaying ? 'musicWidgetSpin 10s linear infinite' : 'none',
                '@keyframes musicWidgetSpin': {
                  to: { transform: 'rotate(360deg)' },
                },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
              }}
            >
              {currentSong?.cover ? (
                <Box
                  component="img"
                  src={getProxyImageUrl(currentSong.cover)}
                  alt={currentSong.name}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <MusicNote sx={{ fontSize: 28, color: 'text.secondary' }} />
              )}
            </Box>

            {/* 歌曲信息 + 控制按钮 */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                {loading ? '加载中...' : currentSong?.name || '未播放'}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.25 }}>
                {currentSong?.artist || '暂无歌曲'}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mt: 0.5 }}>
                <Tooltip title="播放模式">
                  <IconButton size="small" onClick={togglePlayMode}>
                    {MODE_ICONS[playMode]}
                  </IconButton>
                </Tooltip>
                <Tooltip title="上一首">
                  <IconButton size="small" onClick={prev}>
                    <SkipPrevious fontSize="small" />
                  </IconButton>
                </Tooltip>
                <IconButton
                  onClick={togglePlay}
                  size="small"
                  sx={{
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    width: 34,
                    height: 34,
                    '&:hover': { bgcolor: 'primary.dark' },
                  }}
                >
                  {isPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
                </IconButton>
                <Tooltip title="下一首">
                  <IconButton size="small" onClick={next}>
                    <SkipNext fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={isMuted || volume === 0 ? '取消静音' : '静音'}>
                  <IconButton size="small" onClick={toggleMute}>
                    {isMuted || volume === 0 ? (
                      <VolumeOff fontSize="small" />
                    ) : volume < 0.5 ? (
                      <VolumeDown fontSize="small" />
                    ) : (
                      <VolumeUp fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </Box>

          {/* 底部：当前时间 + 播放进度条 + 歌单 */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              pb: 0.5,
            }}
          >
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
            >
              {formatTime(currentTime)}
            </Typography>
            <Slider
              size="small"
              min={0}
              max={1}
              step={0.001}
              value={progressPercent}
              onChange={(_, v) => setProgress(v as number)}
              aria-label="播放进度"
              sx={{ flex: 1 }}
            />
            <Tooltip title="播放列表">
              <IconButton size="small" onClick={() => setShowPlaylist((s) => !s)} sx={{ p: 0.5 }}>
                <QueueMusic fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {showLyric && (
          <>
          {/* 歌词（最多 3 行） */}
          <Box
            sx={{
              px: 1.25,
              pb: 1,
              minHeight: '3.4em',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 0.15,
              overflow: 'hidden',
            }}
          >
            {currentLyricIndex >= 0 && lyrics.length > 0 ? (
              lyrics.slice(Math.max(0, currentLyricIndex - 1), currentLyricIndex + 2).map((line, i) => {
                const actualIndex = Math.max(0, currentLyricIndex - 1) + i;
                const isCurrent = actualIndex === currentLyricIndex;
                return (
                  <Typography
                    key={actualIndex}
                    variant="caption"
                    noWrap
                    sx={{
                      textAlign: 'center',
                      color: isCurrent ? 'primary.main' : 'text.secondary',
                      fontWeight: isCurrent ? 700 : 400,
                      opacity: isCurrent ? 1 : 0.7,
                      transform: isCurrent ? 'scale(1.05)' : 'scale(1)',
                      transformOrigin: 'center',
                      transition: (t) =>
                        t.transitions.create(['color', 'opacity', 'font-weight', 'transform'], {
                          duration: 400,
                          easing: 'ease-in-out',
                        }),
                    }}
                  >
                    {line.text}
                  </Typography>
                );
              })
            ) : (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ textAlign: 'center', opacity: 0.6 }}
              >
                暂无歌词
              </Typography>
            )}
          </Box>
          </>
        )}
        </Box>
      </Box>

      {/* 播放列表（从主卡片下方滑出） */}
      <Box
        sx={{
          width: PANEL_WIDTH,
          maxWidth: 'calc(100vw - 60px)',
          maxHeight: showPlaylist ? PLAYLIST_MAX_HEIGHT : 0,
          overflow: 'hidden',
          transition: (t) =>
            t.transitions.create('max-height', {
              easing: t.transitions.easing.easeInOut,
              duration: 500,
            }),
          
          ...(isLeft
            ? { borderBottomRightRadius: 1 }
            : { borderBottomLeftRadius: 1 }),
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderTop: showPlaylist ? '1px solid' : 'none',
        }}
      >
        <Box ref={listRef} sx={{ maxHeight: PLAYLIST_MAX_HEIGHT, overflowY: 'auto', scrollBehavior: 'smooth' }}>
          {playlist.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 1.5, textAlign: 'center' }}>
              暂无歌曲
            </Typography>
          ) : (
            playlist.map((song, index) => {
              const active = index === player.currentIndex;
              return (
                <Box
                  key={song.id}
                  onClick={() => playAt(index)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1,
                    py: 0.75,
                    cursor: 'pointer',
                    bgcolor: active ? (t) => alpha(t.palette.primary.main, 0.12) : 'transparent',
                    '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.06) },
                  }}
                >
                  {/* 圆形小封面 */}
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                      border: active ? '2px solid' : '1px solid',
                      borderColor: active ? 'primary.main' : 'divider',
                    }}
                  >
                    {song.cover ? (
                      <Box
                        component="img"
                        src={getProxyImageUrl(song.cover)}
                        alt={song.name}
                        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <MusicNote sx={{ fontSize: 16, color: 'text.secondary' }} />
                    )}
                  </Box>
                  {/* 歌名 + 作者/时长 */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{ fontWeight: active ? 700 : 500, color: active ? 'primary.main' : 'text.primary' }}
                    >
                      {song.name}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {song.artist}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
                      >
                        {formatTime(song.duration)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              );
            })
          )}
        </Box>
      </Box>
    </Box>
  );
}
