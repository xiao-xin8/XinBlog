import { createContext, useContext, useState, type ReactNode } from 'react';
import { useMusicPlayer, type MusicPlayerApi } from './useMusicPlayer';
import type { MusicPlayerConfig } from '@/types';

interface MusicPlayerContextValue {
  player: MusicPlayerApi;
  
  showSidebar: boolean;
  setShowSidebar: (v: boolean) => void;
}

const MusicPlayerContext = createContext<MusicPlayerContextValue | null>(null);





export function MusicPlayerProvider({ config, children }: { config?: MusicPlayerConfig; children: ReactNode }) {
  const player = useMusicPlayer(config);
  const [showSidebar, setShowSidebar] = useState(true);
  return (
    <MusicPlayerContext.Provider value={{ player, showSidebar, setShowSidebar }}>
      {children}
    </MusicPlayerContext.Provider>
  );
}





export function useSharedMusicPlayer(): MusicPlayerApi {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) throw new Error('useSharedMusicPlayer must be used within MusicPlayerProvider');
  return ctx.player;
}




export function useSidebarVisible() {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) return { showSidebar: true, setShowSidebar: () => {} };
  return { showSidebar: ctx.showSidebar, setShowSidebar: ctx.setShowSidebar };
}