import { useSiteStore } from '@/stores/siteStore';
import type { MusicPlayerConfig } from '@/types';
import { useMusicPlayer } from './useMusicPlayer';
import { MusicPlayerCard } from './MusicPlayerCard';

interface MusicPlayerEmbeddedProps {
  
  config?: MusicPlayerConfig;
}





export function MusicPlayerEmbedded({ config }: MusicPlayerEmbeddedProps) {
  const storeMusic = useSiteStore((s) => s.config.music);
  const effective = config || storeMusic;
  const player = useMusicPlayer(effective);

  if (!effective?.enabled) return null;
  return <MusicPlayerCard config={effective} player={player} />;
}
