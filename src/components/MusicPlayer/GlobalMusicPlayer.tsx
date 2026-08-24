import { useSiteStore } from '@/stores/siteStore';
import { useSharedMusicPlayer, useSidebarVisible } from './MusicPlayerContext';
import { MusicPlayerWidget } from './MusicPlayerWidget';


export function GlobalMusicPlayer() {
  const music = useSiteStore((s) => s.config.music);
  const player = useSharedMusicPlayer();
  const { showSidebar } = useSidebarVisible();

  if (!music?.enabled) return null;
  if (!showSidebar) return null;
  return <MusicPlayerWidget player={player} position={music.position} showLyric={music.showLyric} />;
}