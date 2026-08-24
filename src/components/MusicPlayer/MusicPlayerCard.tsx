import { Box, Paper, Stack, Typography, IconButton, Slider, alpha, Tooltip, Collapse } from '@mui/material';
import {
  PlayArrow,
  Pause,
  SkipPrevious,
  SkipNext,
  Repeat,
  RepeatOne,
  Shuffle,
  VolumeUp,
  VolumeDown,
  VolumeOff,
  QueueMusic,
  MusicNote,
  ExpandLess,
} from '@mui/icons-material';
import { useEffect, useRef, useState } from 'react';
import type { MusicPlayerConfig } from '@/types';
import { formatTime, getProxyImageUrl } from './musicUtils';
import type { MusicPlayerApi } from './useMusicPlayer';

interface MusicPlayerCardProps {
  config: MusicPlayerConfig;
  player: MusicPlayerApi;
}

const MODE_ICONS: Record<string, React.ReactNode> = {
  list: <Repeat fontSize="small" />,
  single: <RepeatOne fontSize="small" />,
  random: <Shuffle fontSize="small" />,
};

const MODE_LABELS: Record<string, string> = {
  list: '列表循环',
  single: '单曲循环',
  random: '随机播放',
};


export function MusicPlayerCard({ config, player }: MusicPlayerCardProps) {
  const {
    isPlaying,
    loading,
    error,
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
    setVolume,
    toggleMute,
    togglePlayMode,
  } = player;

  const [showPlaylist, setShowPlaylist] = useState(false);
  const lyricWrapperRef = useRef<HTMLDivElement | null>(null);
  const playlistRef = useRef<HTMLDivElement | null>(null);

  
  useEffect(() => {
    const el = playlistRef.current;
    if (!el || !showPlaylist) return;
    const onWheel = (e: WheelEvent) => {
      const scrollable = el.scrollHeight > el.clientHeight;
      if (!scrollable) {
        e.preventDefault();
      } else {
        const atTop = el.scrollTop <= 0;
        const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
        const reachingEdge = (e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom);
        if (reachingEdge) e.preventDefault();
      }
      e.stopPropagation();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [showPlaylist]);

  const progressPercent = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  
  useEffect(() => {
    if (currentLyricIndex < 0) return;
    const wrapper = lyricWrapperRef.current;
    if (!wrapper) return;
    const active = wrapper.children[currentLyricIndex] as HTMLElement | null;
    if (!active) return;
    const targetTop = active.offsetTop - wrapper.clientHeight / 2 + active.clientHeight / 2;
    wrapper.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
  }, [currentLyricIndex]);

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.5, sm: 3 },
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: (t) =>
          t.palette.mode === 'light'
            ? `0 4px 20px ${alpha(t.palette.primary.main, 0.08)}`
            : `0 4px 20px ${alpha(t.palette.common.black, 0.25)}`,
      }}
    >
      {error && (
        <Typography
          variant="body2"
          color="error"
          sx={{ mb: 2, p: 1.5, borderRadius: 1, bgcolor: (t) => alpha(t.palette.error.main, 0.08), overflowWrap: 'break-word' }}
        >
          {error}
        </Typography>

      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 2, sm: 3 }} alignItems="center">
        {}
        <Box sx={{ position: 'relative', width: { xs: 120, sm: 140, md: 160 }, height: { xs: 120, sm: 140, md: 160 }, flexShrink: 0 }}>
          <Box
            sx={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              overflow: 'hidden',
              border: '3px solid',
              borderColor: (t) => alpha(t.palette.primary.main, 0.35),
              boxShadow: (t) => `0 8px 32px ${alpha(t.palette.primary.main, 0.25)}`,
              animation: isPlaying ? 'musicCoverSpin 14s linear infinite' : 'none',
              '@keyframes musicCoverSpin': {
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
              <MusicNote sx={{ fontSize: 48, color: 'text.secondary' }} />
            )}
          </Box>

          <Tooltip title={isPlaying ? '暂停' : '播放'}>
            <IconButton
              onClick={togglePlay}
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 52,
                height: 52,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': { bgcolor: 'primary.dark' },
              }}
            >
              {isPlaying ? <Pause /> : <PlayArrow />}
            </IconButton>

          </Tooltip>

        </Box>


        {}
        <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
          <Typography
            variant="h6"
            sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {loading ? '加载中...' : currentSong?.name || '未播放'}
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentSong?.artist || '请在下方选择歌曲或配置歌单'}
          </Typography>


          {}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
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
            <Typography variant="caption" sx={{ color: 'text.secondary', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(duration)}
            </Typography>

          </Box>


          {}
          <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5} sx={{ mt: 0.5 }}>
            <Tooltip title={MODE_LABELS[playMode]}>
              <IconButton size="small" onClick={togglePlayMode}>
                {MODE_ICONS[playMode]}
              </IconButton>

            </Tooltip>

            <Tooltip title="上一首">
              <IconButton onClick={prev}>
                <SkipPrevious />
              </IconButton>

            </Tooltip>

            <IconButton
              onClick={togglePlay}
              sx={{
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                width: 44,
                height: 44,
                '&:hover': { bgcolor: 'primary.dark' },
              }}
            >
              {isPlaying ? <Pause /> : <PlayArrow />}
            </IconButton>

            <Tooltip title="下一首">
              <IconButton onClick={next}>
                <SkipNext />
              </IconButton>

            </Tooltip>

            <Tooltip title="播放列表">
              <IconButton size="small" onClick={() => setShowPlaylist((s) => !s)}>
                <QueueMusic />
              </IconButton>

            </Tooltip>

          </Stack>


          {}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <IconButton size="small" onClick={toggleMute} aria-label="静音">
              {isMuted || volume === 0 ? <VolumeOff fontSize="small" /> : volume < 0.5 ? <VolumeDown fontSize="small" /> : <VolumeUp fontSize="small" />}
            </IconButton>

            <Slider
              size="small"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(_, v) => setVolume(v as number)}
              aria-label="音量"
              sx={{ flex: 1 }}
            />
          </Box>

        </Box>

      </Stack>


      {}
      <Collapse in={showPlaylist} timeout={300}>
        <Box
          ref={playlistRef}
          sx={{
            mt: 2,
            maxHeight: 220,
            overflow: 'auto',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: (t) => alpha(t.palette.primary.main, 0.02),
          }}
        >
          {playlist.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
              暂无歌曲，请先配置网易云歌单
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
                    gap: 1.5,
                    px: 2,
                    py: 1,
                    cursor: 'pointer',
                    bgcolor: active ? (t) => alpha(t.palette.primary.main, 0.1) : 'transparent',
                    color: active ? 'primary.main' : 'text.primary',
                    '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.06) },
                  }}
                >
                  <Typography variant="caption" sx={{ width: 20, flexShrink: 0, textAlign: 'right', opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>
                    {index + 1}
                  </Typography>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: active ? 700 : 500 }}>
                      {song.name}
                    </Typography>

                    <Typography variant="caption" color="text.secondary" noWrap>
                      {song.artist}
                    </Typography>

                  </Box>

                  <Typography variant="caption" sx={{ flexShrink: 0, opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>
                    {formatTime(song.duration)}
                  </Typography>

                </Box>

              );
            })
          )}
        </Box>

      </Collapse>


      {}
      {playlist.length > 0 && (
        <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'center' }}>
          <Typography
            variant="caption"
            sx={{ color: 'primary.main', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5 }}
            onClick={() => setShowPlaylist((s) => !s)}
          >
            <ExpandLess
              sx={{
                fontSize: 14,
                transform: showPlaylist ? 'rotate(180deg)' : 'none',
                transition: (t) => t.transitions.create('transform'),
              }}
            />
            {showPlaylist ? '收起播放列表' : `展开播放列表（${playlist.length} 首）`}
          </Typography>

        </Box>

      )}

      {}
      {config.showLyric && lyrics.length > 0 && (
        <Box
          ref={lyricWrapperRef}
          sx={{
            mt: 2,
            maxHeight: 220,
            overflow: 'auto',
            scrollBehavior: 'smooth',
            position: 'relative',
            borderRadius: 1,
            bgcolor: (t) => alpha(t.palette.primary.main, 0.03),
            p: 1.5,
          }}
        >
          {lyrics.map((line, index) => {
            const active = index === currentLyricIndex;
            return (
              <Typography
                key={index}
                variant="body1"
                sx={{
                  py: 0.5,
                  px: 1,
                  textAlign: 'center',
                  borderRadius: 0.5,
                  bgcolor: active ? (t) => alpha(t.palette.primary.main, 0.08) : 'transparent',
                  color: active ? 'primary.main' : 'text.secondary',
                  fontWeight: active ? 700 : 400,
                  fontSize: active ? '1rem' : '0.9rem',
                  transform: active ? 'scale(1.03)' : 'scale(1)',
                  transformOrigin: 'center',
                  transition: (t) =>
                    t.transitions.create(['color', 'font-weight', 'font-size', 'transform', 'background-color'], {
                      duration: 400,
                      easing: 'ease-in-out',
                    }),
                }}
              >
                {line.text}
              </Typography>

            );
          })}
        </Box>

      )}
    </Paper>

  );
}