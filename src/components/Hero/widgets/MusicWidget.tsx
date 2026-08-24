import { useEffect, useRef, useState } from 'react';
import { Box, IconButton, Slider, Typography, alpha, keyframes, CircularProgress } from '@mui/material';
import { PlayArrow, Pause, MusicNote, SkipPrevious, SkipNext } from '@mui/icons-material';
import type { HeroWidgetConfig } from '@/types';

interface NeteaseTrack {
  id: string | number;
  title: string;
  artist: string;
  cover: string;
  src: string;
  lrcUrl?: string;
}

interface MusicWidgetPropsFromConfig {
  mode?: 'single' | 'netease';
  src?: string;
  title?: string;
  artist?: string;
  cover?: string;
  songIds?: string;
  autoplay?: boolean;
}

interface LyricLine {
  time: number;
  text: string;
}

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

function parseLrc(lrcText: string): LyricLine[] {
  if (!lrcText || lrcText.length > 20000) return [];
  const lines = lrcText.split('\n');
  const result: LyricLine[] = [];
  for (const line of lines) {
    const matches = [...line.matchAll(/\[(\d{2,}):(\d{2})(?:\.(\d{2,3}))?\]/g)];
    if (matches.length > 0) {
      const text = line.replace(/\[\d{2,}:\d{2}(?:\.\d{2,3})?\]/g, '').trim();
      if (text) {
        for (const match of matches) {
          const min = parseInt(match[1], 10);
          const sec = parseInt(match[2], 10);
          const ms = match[3] ? parseInt(match[3], 10) : 0;
          const time = min * 60 + sec + ms / (match[3] && match[3].length === 3 ? 1000 : 100);
          result.push({ time, text });
        }
      }
    }
  }
  return result.sort((a, b) => a.time - b.time);
}

function formatTime(t: number) {
  if (!isFinite(t) || isNaN(t)) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function parseSongIds(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function MusicWidget({ config }: { config: HeroWidgetConfig }) {
  const props = (config.props || {}) as MusicWidgetPropsFromConfig;
  const mode = props.mode || 'single';

  const [playlist, setPlaylist] = useState<NeteaseTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [currentLyric, setCurrentLyric] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  
  useEffect(() => {
    if (mode !== 'single') return;
    const single: NeteaseTrack = {
      id: 'single',
      title: props.title || '未配置音乐',
      artist: props.artist || '请在编辑中填写音频地址',
      src: props.src || '',
      cover: props.cover || '',
    };
    setPlaylist(single.src ? [single] : []);
    setCurrentIndex(0);
    setCurrentLyric('');
    setLyrics([]);
  }, [mode, props.src, props.title, props.artist, props.cover]);

  
  useEffect(() => {
    if (mode !== 'netease') return;
    const ids = parseSongIds(props.songIds);
    if (ids.length === 0) {
      setPlaylist([]);
      setCurrentLyric('请配置网易云音乐 ID');
      return;
    }
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      try {
        const results = await Promise.all(
          ids.map((id) =>
            fetch(`https://api.injahow.cn/meting/?server=netease&type=song&id=${id}`)
              .then((res) => (res.ok ? res.json() : null))
              .catch(() => null)
          )
        );
        if (cancelled) return;
        const merged: NeteaseTrack[] = results
          .filter((res) => Array.isArray(res) && res.length > 0)
          .map((res) => {
            const song = res[0];
            return {
              id: song.id,
              title: song.name || '未知歌曲',
              artist: song.artist || '未知歌手',
              cover: song.cover || '',
              src: song.url || '',
              lrcUrl: song.lrc || '',
            };
          })
          .filter((song) => song.src);
        setPlaylist(merged);
        setCurrentIndex(0);
        if (merged.length === 0) {
          setCurrentLyric('未能加载任何曲目');
        } else {
          setCurrentLyric('♪ 准备播放 ♪');
        }
      } catch {
        if (!cancelled) setCurrentLyric('歌单加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [mode, props.songIds]);

  const currentSong = playlist[currentIndex];

  
  useEffect(() => {
    if (!currentSong) {
      setLyrics([]);
      setCurrentLyric('');
      return;
    }
    setCurrentTime(0);
    setDuration(0);
    setLyrics([]);
    setCurrentLyric('♪ 纯享音乐 ♪');

    if (!currentSong.lrcUrl) return;
    let cancelled = false;
    fetch(currentSong.lrcUrl)
      .then((res) => (res.ok ? res.text() : ''))
      .then((text) => {
        if (cancelled) return;
        const parsed = parseLrc(text);
        setLyrics(parsed);
        if (parsed.length > 0) setCurrentLyric(parsed[0].text);
      })
      .catch(() => {
        if (!cancelled) setCurrentLyric('♪ 纯享音乐 ♪');
      });
    return () => {
      cancelled = true;
    };
  }, [currentSong]);

  
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;
    audio.src = currentSong.src;
    audio.load();
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false));
    }
    
  }, [currentSong?.src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const prevSong = () => {
    if (playlist.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
  };

  const nextSong = () => {
    if (playlist.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % playlist.length);
  };

  const handleSeek = (_: Event, value: number | number[]) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const progress = Array.isArray(value) ? value[0] : value;
    audio.currentTime = (progress / 100) * duration;
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const { currentTime: ct, duration: dur } = audio;
    setCurrentTime(ct);
    setDuration(dur || 0);
    if (lyrics.length > 0) {
      const active = lyrics.slice().reverse().find((l) => ct >= l.time);
      if (active) setCurrentLyric(active.text);
    }
  };

  const coverUrl = currentSong?.cover || '';
  const hasMultiple = playlist.length > 1;

  
  const { w, h } = config;
  const isTiny = w === 1 && h === 1;
  const isTall = w === 1 && h >= 2;
  const isWide = h === 1 && w >= 2;
  const isCompact = (w === 2 && h === 2) || isWide || (isTall && h === 2);
  const isLarge = w >= 3 && h >= 2;
  const coverSize = isTiny ? 32 : isCompact ? 40 : isLarge ? 64 : 52;
  const playButtonSize = isTiny ? 32 : isCompact ? 36 : isLarge ? 52 : 44;
  const showLyric = !isTiny && !isWide;

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        p: isCompact ? 1.5 : 2,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: isCompact ? 0.5 : 1,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {}
      <Box
        sx={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 120,
          height: 120,
          borderRadius: '50%',
          bgcolor: (theme) => alpha(theme.palette.primary.main, isPlaying ? 0.18 : 0.08),
          filter: 'blur(40px)',
          transition: (theme) =>
            theme.transitions.create('background-color', {
              duration: theme.transitions.duration.standard,
            }),
          zIndex: 0,
        }}
      />

      <Box
        sx={{
          display: 'flex',
          flexDirection: isTall ? 'column' : 'row',
          alignItems: isTall ? 'flex-start' : 'center',
          gap: isCompact ? 1 : 1.5,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box
          sx={{
            width: coverSize,
            height: coverSize,
            borderRadius: '50%',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
            border: (theme) => `2px solid ${alpha(theme.palette.common.white, 0.5)}`,
            boxShadow: (theme) => `0 4px 16px ${alpha(theme.palette.common.black, 0.12)}`,
            animation: isPlaying ? `${spin} 8s linear infinite` : 'none',
          }}
        >
          {coverUrl ? (
            <Box component="img" src={coverUrl} alt={currentSong?.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                color: 'primary.main',
              }}
            >
              <MusicNote />
            </Box>

          )}
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 14,
              height: 14,
              borderRadius: '50%',
              bgcolor: (theme) => alpha(theme.palette.background.paper, 0.9),
              border: (theme) => `1px solid ${theme.palette.divider}`,
            }}
          />
        </Box>


        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle2" fontWeight={700} noWrap>
            {currentSong?.title || '未配置音乐'}
          </Typography>

          <Typography variant="caption" color="text.secondary" noWrap>
            {currentSong?.artist || (mode === 'netease' ? '请填写网易云音乐 ID' : '请在编辑中填写音频地址')}
          </Typography>

          {hasMultiple && (
            <Typography variant="caption" color="primary" sx={{ display: 'block' }}>
              {currentIndex + 1} / {playlist.length}
            </Typography>

          )}
        </Box>

      </Box>


      {}
      {showLyric && (
        <Typography
          variant="caption"
          sx={{
            position: 'relative',
            zIndex: 1,
            textAlign: 'center',
            color: 'text.secondary',
            fontWeight: 600,
            minHeight: 20,
            px: 1,
          }}
          noWrap
        >
          {loading ? '加载歌单中...' : currentLyric}
        </Typography>

      )}

      {}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, position: 'relative', zIndex: 1 }}>
        <IconButton size="small" onClick={prevSong} disabled={!hasMultiple || loading} sx={{ color: 'text.primary' }}>
          <SkipPrevious fontSize="small" />
        </IconButton>

        <IconButton
          size="medium"
          onClick={togglePlay}
          disabled={!currentSong || loading}
          sx={{
            color: 'common.white',
            bgcolor: 'primary.main',
            width: playButtonSize,
            height: playButtonSize,
            boxShadow: (theme) => `0 4px 14px ${alpha(theme.palette.primary.main, 0.4)}`,
            '&:hover': { bgcolor: 'primary.dark', transform: 'scale(1.08)' },
            '&.Mui-disabled': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.3) },
          }}
        >
          {isPlaying ? <Pause fontSize={isCompact ? 'small' : 'medium'} /> : <PlayArrow fontSize={isCompact ? 'small' : 'medium'} />}
        </IconButton>

        <IconButton size="small" onClick={nextSong} disabled={!hasMultiple || loading} sx={{ color: 'text.primary' }}>
          <SkipNext fontSize="small" />
        </IconButton>

      </Box>


      {}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, position: 'relative', zIndex: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {formatTime(currentTime)}
        </Typography>

        <Slider
          size="small"
          value={duration ? (currentTime / duration) * 100 : 0}
          onChange={handleSeek}
          disabled={!currentSong}
          sx={{
            flex: 1,
            '& .MuiSlider-thumb': {
              width: 10,
              height: 10,
              transition: (theme) => theme.transitions.create('transform', { duration: theme.transitions.duration.shortest }),
              '&:hover, &.Mui-focusVisible': { transform: 'scale(1.4)' },
            },
          }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 32, fontVariantNumeric: 'tabular-nums' }}>
          {formatTime(duration)}
        </Typography>

      </Box>


      {loading && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.5),
            zIndex: 2,
            borderRadius: 'inherit',
          }}
        >
          <CircularProgress size={24} />
        </Box>

      )}

      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={nextSong}
      />
    </Box>

  );
}
