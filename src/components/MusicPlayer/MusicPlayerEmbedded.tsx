import { useSiteStore } from '@/stores/siteStore';
import type { MusicPlayerConfig } from '@/types';
import { useMusicPlayer } from './useMusicPlayer';
import { MusicPlayerCard } from './MusicPlayerCard';

interface MusicPlayerEmbeddedProps {
  /** 传入自定义配置（如管理后台预览）；未传入时使用站点配置 */
  config?: MusicPlayerConfig;
}

/**
 * 页面嵌入形态的音乐播放器：
 * 传入 config 时使用该配置（常用于管理后台实时预览），否则读取站点配置。
 */
export function MusicPlayerEmbedded({ config }: MusicPlayerEmbeddedProps) {
  const storeMusic = useSiteStore((s) => s.config.music);
  const effective = config || storeMusic;
  const player = useMusicPlayer(effective);

  if (!effective?.enabled) return null;
  return <MusicPlayerCard config={effective} player={player} />;
}
