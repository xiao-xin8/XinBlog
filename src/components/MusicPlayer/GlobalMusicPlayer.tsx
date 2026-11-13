import { useSiteStore } from '@/stores/siteStore';
import { useSharedMusicPlayer, useSidebarVisible } from './MusicPlayerContext';
import { MusicPlayerWidget } from './MusicPlayerWidget';

/**
 * 全局侧边悬浮音乐播放器：
 * 从共享 Context 读取播放器实例，与音乐页面共享同一状态。
 * 在音乐页面时由 MusicPage 设置 showSidebar=false 隐藏侧边组件。
 */
export function GlobalMusicPlayer() {
  const music = useSiteStore((s) => s.config.music);
  const player = useSharedMusicPlayer();
  const { showSidebar } = useSidebarVisible();

  if (!music?.enabled) return null;
  if (!showSidebar) return null;
  return <MusicPlayerWidget player={player} position={music.position} showLyric={music.showLyric} />;
}