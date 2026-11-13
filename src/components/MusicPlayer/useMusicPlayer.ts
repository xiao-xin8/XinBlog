import { useCallback, useEffect, useRef, useState } from 'react';
import type { MusicPlayerConfig, MusicPlayMode } from '@/types';
import {
  DEFAULT_MUSIC_CONFIG,
  parseLyric,
  loadMusicMemory,
  saveMusicMemory,
  type Song,
  type LyricLine,
} from './musicUtils';

export interface MusicPlayerApi {
  isPlaying: boolean;
  loading: boolean;
  error: string;
  currentIndex: number;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playMode: MusicPlayMode;
  playlist: Song[];
  lyrics: LyricLine[];
  currentLyricIndex: number;
  currentSong: Song | null;
  togglePlay: () => void;
  playAt: (index: number) => void;
  prev: () => void;
  next: () => void;
  setProgress: (percent: number) => void;
  setVolume: (percent: number) => void;
  toggleMute: () => void;
  togglePlayMode: () => void;
}

/**
 * 音乐播放器核心逻辑（参照 pz-music-player.js 的实现 1:1 迁移）：
 * - 网易云歌单加载（apiUrl + playlistId）
 * - 歌曲 URL / 歌词拉取
 * - 播放/暂停/上一首/下一首/进度/音量/静音
 * - 播放模式：列表循环 / 单曲循环 / 随机
 * - 歌词解析与当前句高亮索引
 * - 记忆播放（localStorage 记录上次歌曲/进度/音量/模式）
 * - 音频加载失败自动跳下一首（连续失败 3 次停止）
 */
export function useMusicPlayer(config?: Partial<MusicPlayerConfig>): MusicPlayerApi {
  const effective: MusicPlayerConfig = { ...DEFAULT_MUSIC_CONFIG, ...(config || {}) };
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(effective.volume);
  const [isMuted, setIsMuted] = useState(false);
  const [playMode, setPlayMode] = useState<MusicPlayMode>(effective.playMode);
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const errorCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 保存最新的 playNext 函数引用，供 useEffect 内事件回调使用
  const playNextRef = useRef<() => void>(() => {});

  // 供事件回调读取的最新快照，避免闭包过期
  const ctxRef = useRef({ config: effective, playMode, currentIndex, playlist, volume });
  ctxRef.current = { config: effective, playMode, currentIndex, playlist, volume };

  // ---------- 音频元素 ----------
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;
    document.body.appendChild(audio);

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      // 兜底：部分移动端浏览器 duration 在 loadedmetadata 后仍为 0/Infinity，
      // 这里在 timeupdate 期间持续校正，避免进度条停留在 0。
      const d = audio.duration;
      if (isFinite(d) && d > 0) {
        setDuration((prev) => (Math.abs(prev - d) > 0.05 ? d : prev));
      }
      const songs = ctxRef.current.playlist;
      const lrcs = lyricsRef.current;
      if (lrcs.length > 0) {
        let idx = -1;
        for (let i = 0; i < lrcs.length; i++) {
          if (audio.currentTime >= lrcs[i].time) idx = i;
          else break;
        }
        setCurrentLyricIndex((prev) => (prev === idx ? prev : idx));
      } else if (songs.length > 0) {
        setCurrentLyricIndex(-1);
      }
      const cfg = ctxRef.current.config;
      if (cfg.memory) {
        saveMusicMemory({
          currentIndex: ctxRef.current.currentIndex,
          currentTime: audio.currentTime,
          volume: audio.volume,
          playMode: ctxRef.current.playMode,
        });
      }
    };
    // 移动端流式音频可能出现 duration 为 Infinity/NaN，统一用 isFinite 防御
    const onLoadedMetadata = () => {
      const d = audio.duration;
      setDuration(isFinite(d) && d > 0 ? d : 0);
    };
    const onDurationChange = () => {
      const d = audio.duration;
      setDuration(isFinite(d) && d > 0 ? d : 0);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      if (ctxRef.current.playMode === 'single') {
        audio.currentTime = 0;
        void audio.play().catch(() => {});
      } else {
        playNextRef.current();
      }
    };
    const onError = () => {
      errorCountRef.current += 1;
      if (errorCountRef.current < 3) {
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => playNext(), 1500);
      } else {
        setError('音频加载失败，请检查网络或切换歌曲');
        setLoading(false);
        errorCountRef.current = 0;
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      document.body.removeChild(audio);
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 歌词引用（供 audio 事件内使用）
  const lyricsRef = useRef<LyricLine[]>([]);
  useEffect(() => {
    lyricsRef.current = lyrics;
  }, [lyrics]);

  // 加载歌词
  const loadLyric = useCallback(async (songId: number) => {
    const cfg = ctxRef.current.config;
    if (!cfg.showLyric) {
      setLyrics([]);
      return;
    }
    try {
      const res = await fetch(`${cfg.apiUrl}/musicAll/?lyric=${songId}`);
      const data = await res.json();
      if (data.lrc && data.lrc.lyric) {
        setLyrics(parseLyric(data.lrc.lyric));
      } else {
        setLyrics([]);
      }
    } catch {
      setLyrics([]);
    }
  }, []);

  // 加载单曲（songs 可选：传入则直接使用，不传从 ctxRef 读取）
  const loadSong = useCallback(
    (index: number, autoplay = true, songsOverride?: Song[]) => {
      const songs = songsOverride || ctxRef.current.playlist;
      const song = songs[index];
      if (!song) return;

      setCurrentIndex(index);
      setCurrentLyricIndex(-1);
      setError('');
      errorCountRef.current = 0;

      const audio = audioRef.current;
      if (audio) {
        audio.src = song.url;
        audio.load();
        if (autoplay) {
          void audio.play().catch((err) => {
            if (err.name === 'NotAllowedError') {
              // 浏览器未授权自动播放（未交互）——保持静默，等待用户点击
              setIsPlaying(false);
              return;
            }
            setError('播放失败，请稍后重试');
          });
        }
      }

      if (ctxRef.current.config.showLyric) {
        void loadLyric(song.id);
      }
    },
    [loadLyric]
  );

  // 加载歌单
  const loadPlaylist = useCallback(async () => {
    const cfg = ctxRef.current.config;
    if (!cfg.playlistId.trim()) {
      setPlaylist([]);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${cfg.apiUrl}/musicAll/?playlistId=${encodeURIComponent(cfg.playlistId)}`);
      const data = await res.json();
      if (data.playlist && data.playlist.tracks) {
        const songs: Song[] = data.playlist.tracks.map((track: Record<string, unknown>) => {
          const id = Number(track.id);
          const ar = (track.ar as { name?: string }[] | undefined) || [];
          const al = (track.al as { name?: string; picUrl?: string } | undefined) || {};
          return {
            id,
            name: String(track.name || '未知歌曲'),
            artist: ar.map((a) => a.name || '').filter(Boolean).join(' / '),
            album: al.name || '',
            cover: al.picUrl || '',
            url: `${cfg.apiUrl}/musicAll/?songId=${id}&mp3Url=mp3`,
            duration: Number(track.dt || 0) / 1000,
          };
        });
        setPlaylist(songs);
        setLoading(false);

        if (songs.length > 0) {
          // 记忆播放：歌单加载完成后恢复上次歌曲与进度
          const memory = cfg.memory ? loadMusicMemory() : null;
          if (memory && memory.currentIndex !== undefined && memory.currentIndex < songs.length) {
            if (memory.volume !== undefined) {
              setVolume(memory.volume);
            }
            if (memory.playMode) {
              setPlayMode(memory.playMode);
            }
            loadSong(memory.currentIndex, cfg.autoplay, songs);
            if (audioRef.current && memory.currentTime) {
              audioRef.current.currentTime = memory.currentTime;
            }
          } else {
            // 默认加载第一首（是否自动播放由配置决定；未开启时也正常显示歌曲信息）
            loadSong(0, cfg.autoplay, songs);
          }
        } else {
          setError('歌单为空');
        }
      } else {
        setPlaylist([]);
        setLoading(false);
        setError('歌单加载失败，请检查歌单 ID 或 API 地址');
      }
    } catch {
      setPlaylist([]);
      setLoading(false);
      setError('歌单加载失败，请检查网络连接');
    }
  }, [loadSong]);

  // 歌单/API 变化时重新加载
  useEffect(() => {
    void loadPlaylist();
  }, [loadPlaylist]);

  // 音量同步
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // 静音同步
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // 播放
  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.src) {
      const songs = ctxRef.current.playlist;
      if (songs.length > 0) {
        loadSong(ctxRef.current.currentIndex >= 0 ? ctxRef.current.currentIndex : 0);
        return;
      }
      return;
    }
    void audio.play().catch((err) => {
      if (err.name === 'NotAllowedError') return;
      setError('播放失败，请稍后重试');
    });
  }, [loadSong]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    if (ctxRef.current.playlist.length === 0) return;
    if (audioRef.current?.paused) {
      play();
    } else {
      pause();
    }
  }, [play, pause]);

  // 下一首（对外：按模式选择）
  const playNext = useCallback(() => {
    const songs = ctxRef.current.playlist;
    if (songs.length === 0) return;
    let index: number;
    if (ctxRef.current.playMode === 'random') {
      index = Math.floor(Math.random() * songs.length);
    } else {
      index = (ctxRef.current.currentIndex + 1) % songs.length;
    }
    loadSong(index);
  }, [loadSong]);

  // 同步 ref 供 useEffect 内事件回调使用
  playNextRef.current = playNext;

  // 上一首
  const playPrev = useCallback(() => {
    const songs = ctxRef.current.playlist;
    if (songs.length === 0) return;
    let index: number;
    if (ctxRef.current.playMode === 'random') {
      index = Math.floor(Math.random() * songs.length);
    } else {
      index = (ctxRef.current.currentIndex - 1 + songs.length) % songs.length;
    }
    loadSong(index);
  }, [loadSong]);

  const next = useCallback(() => playNext(), [playNext]);

  const prev = useCallback(() => playPrev(), [playPrev]);

  // 播放指定歌曲
  const playAt = useCallback(
    (index: number) => {
      const songs = ctxRef.current.playlist;
      if (index < 0 || index >= songs.length) return;
      loadSong(index);
    },
    [loadSong]
  );

  // 进度跳转
  const setProgress = useCallback((percent: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const d = audio.duration;
    if (!isFinite(d) || d <= 0) return;
    const p = Math.max(0, Math.min(1, percent));
    audio.currentTime = p * d;
    setCurrentTime(audio.currentTime);
  }, []);

  // 音量
  const setVolume = useCallback((percent: number) => {
    const p = Math.max(0, Math.min(1, percent));
    setVolumeState(p);
    const audio = audioRef.current;
    if (audio) {
      audio.volume = p;
      if (p === 0) {
        audio.muted = true;
        setIsMuted(true);
      } else if (audio.muted) {
        audio.muted = false;
        setIsMuted(false);
      }
    }
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setIsMuted(audio.muted);
  }, []);

  // 播放模式切换
  const togglePlayMode = useCallback(() => {
    const modes: MusicPlayMode[] = ['list', 'single', 'random'];
    const current = modes.indexOf(ctxRef.current.playMode);
    const nextMode = modes[(current + 1) % modes.length];
    ctxRef.current = { ...ctxRef.current, playMode: nextMode };
    setPlayMode(nextMode);
  }, []);

  const currentSong = playlist[currentIndex] || null;

  return {
    isPlaying,
    loading,
    error,
    currentIndex,
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
  };
}
