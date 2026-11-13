import { createContext, useContext, useState, type ReactNode } from 'react';
import { useMusicPlayer, type MusicPlayerApi } from './useMusicPlayer';
import type { MusicPlayerConfig } from '@/types';

interface MusicPlayerContextValue {
  player: MusicPlayerApi;
  /** 是否显示侧边播放器（音乐页面设为 false） */
  showSidebar: boolean;
  setShowSidebar: (v: boolean) => void;
}

const MusicPlayerContext = createContext<MusicPlayerContextValue | null>(null);

/**
 * 音乐播放器全局上下文 Provider。
 * 在 App 顶层挂载，确保 GlobalMusicPlayer 与 MusicPage 共享同一播放器实例。
 */
export function MusicPlayerProvider({ config, children }: { config?: MusicPlayerConfig; children: ReactNode }) {
  const player = useMusicPlayer(config);
  const [showSidebar, setShowSidebar] = useState(true);
  return (
    <MusicPlayerContext.Provider value={{ player, showSidebar, setShowSidebar }}>
      {children}
    </MusicPlayerContext.Provider>
  );
}

/**
 * 获取共享的音乐播放器实例。
 * 必须在 MusicPlayerProvider 内部调用。
 */
export function useSharedMusicPlayer(): MusicPlayerApi {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) throw new Error('useSharedMusicPlayer must be used within MusicPlayerProvider');
  return ctx.player;
}

/**
 * 获取侧边播放器显示状态。
 */
export function useSidebarVisible() {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) return { showSidebar: true, setShowSidebar: () => {} };
  return { showSidebar: ctx.showSidebar, setShowSidebar: ctx.setShowSidebar };
}