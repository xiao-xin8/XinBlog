import type { MusicPlayMode, MusicPlayerConfig } from '@/types';
import { useSiteStore } from '@/stores/siteStore';


export const DEFAULT_MUSIC_CONFIG: MusicPlayerConfig = {
  enabled: false,
  apiUrl: 'https://api.xfyun.club',
  playlistId: '',
  volume: 0.8,
  playMode: 'list',
  autoplay: true,
  showLyric: true,
  memory: true,
  position: 'right',
  showInAdmin: true,
  showPage: true,
  imageProxy: false,
};


export interface Song {
  id: number;
  name: string;
  artist: string;
  album: string;
  cover: string;
  url: string;
  duration: number;
}

export interface LyricLine {
  time: number;
  text: string;
}

export interface MusicMemory {
  currentIndex: number;
  currentTime: number;
  volume: number;
  playMode: MusicPlayMode;
}

const STORAGE_KEY = 'xinblog-music-player';


export const PRESET_PLAYLISTS: { id: string; name: string; desc: string }[] = [
  { id: '3778678', name: '精选热歌', desc: '网易云音乐官方热门歌单' },
  { id: '17990594711', name: '纯音乐｜专注放松', desc: '清新氛围纯音乐精选' },
  { id: '17980094136', name: '森系治愈', desc: '舒缓清新纯音乐' },
  { id: '17980906438', name: '国风古风大赏', desc: '歌声岂合世间闻' },
  { id: '18031402205', name: 'KPOP舞力全开', desc: '跟着元气节拍嗨跳' },
  { id: '18044533175', name: '二次元神曲', desc: '一秒飙升情绪燃点' },
  { id: '26467411', name: '经典轻音乐', desc: '那些你熟悉却又不知道名字的轻音乐' },
  { id: '17903991254', name: '欧美流行', desc: '全球青春修炼手册' },
  { id: '17429985859', name: 'KPOP宝藏节奏', desc: '洗澡/跑步/写作业BGM' },
  { id: '17974209281', name: 'R&B午夜低音', desc: '沙发上的慵懒气泡' },
  { id: '18063256295', name: '冰镇欧美嗓音', desc: '夏日祛暑凉方' },
  { id: '18012662203', name: '古风雅律', desc: '一纸风雅 竹丝遗旧韵' },
  { id: '17813422123', name: '健身歌单', desc: '高燃 Kpop+欧美 pop 流行合集' },
  { id: '14343553499', name: '看书纯音乐', desc: '看小说/写小说可听纯音乐' },
  { id: '17995611950', name: 'R&B慵懒小调', desc: '放慢节奏，慢慢听' },
  { id: '18083194638', name: '素颜说唱', desc: '不完美才是真实Flow' },
  { id: '17882848538', name: '蓝调', desc: '蓝色是最温柔的忧郁' },
  { id: '18140992859', name: '华语R&B', desc: '浪漫节奏布鲁斯' },
  { id: '18129092448', name: '摇滚回响', desc: '绿茵摇滚诗：英格兰世界杯回响' },
  { id: '17987417003', name: '歌手2026', desc: '三代歌者巅峰对决' },
];





export function extractUrlFromText(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"'{}\[\]]+/);
  return match ? match[0].replace(/[`'"’‘“”]+$/, '') : null;
}





export async function resolveShortUrl(url: string): Promise<string | null> {
  try {
    const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || '';
    const res = await fetch(`${apiBase}/api/v1/resolve-url?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (data.code === 0 && data.data?.finalUrl) {
      return data.data.finalUrl;
    }
    return null;
  } catch {
    return null;
  }
}




export function isValidPlaylistId(id: string): boolean {
  return /^\d{5,}$/.test(id.trim());
}













export function parsePlaylistId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;

  
  const url = extractUrlFromText(trimmed);
  const target = url || trimmed;

  
  const idParamMatch = target.match(/[?&]id=(\d+)/);
  if (idParamMatch) return idParamMatch[1];

  
  const pathMatch = target.match(/\/playlist\/(\d+)/);
  if (pathMatch) return pathMatch[1];

  
  const shareMatch = target.match(/\/share\/playlist\/(\d+)/);
  if (shareMatch) return shareMatch[1];

  
  if (/163cn\.tv/i.test(target)) return target;

  
  const pureNumberMatch = target.match(/^(\d{5,})$/);
  if (pureNumberMatch) return pureNumberMatch[1];

  return trimmed;
}

export function formatTime(seconds: number): string {
  if (Number.isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}


export function parseLyric(lyricText: string): LyricLine[] {
  if (!lyricText) return [];
  const lines = lyricText.split('\n');
  const lyrics: LyricLine[] = [];

  lines.forEach((line) => {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
    if (match) {
      const min = parseInt(match[1]);
      const sec = parseInt(match[2]);
      const ms = parseInt(match[3].padEnd(3, '0'));
      const time = min * 60 + sec + ms / 1000;
      const text = match[4].trim();
      if (text) {
        lyrics.push({ time, text });
      }
    }
  });

  return lyrics.sort((a, b) => a.time - b.time);
}

export function loadMusicMemory(): MusicMemory | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MusicMemory;
  } catch {
    return null;
  }
}

export function saveMusicMemory(memory: MusicMemory) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // ignore
  }
}





export function getProxyImageUrl(url: string): string {
  if (!url) return '';
  
  if (url.startsWith('/') || url.startsWith('./') || url.startsWith(window.location.origin)) return url;
  
  const imageProxy = useSiteStore.getState().config.music?.imageProxy ?? false;
  if (!imageProxy) return url;
  
  return `/api/v1/proxy-image?url=${encodeURIComponent(url)}`;
}
