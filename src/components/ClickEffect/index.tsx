import { memo } from 'react';
import { useSiteStore } from '@/stores/siteStore';
import { useTheme } from '@mui/material/styles';
import { HeartEffect } from './effects/HeartEffect';
import { RippleEffect } from './effects/RippleEffect';
import { BubbleEffect } from './effects/BubbleEffect';
import { TextEffect } from './effects/TextEffect';
import { FireworkEffect } from './effects/FireworkEffect';
import { StarEffect } from './effects/StarEffect';
import { ConfettiEffect } from './effects/ConfettiEffect';
export const ClickEffect = memo(function ClickEffect() {
  const { config } = useSiteStore();
  const theme = useTheme();
  const clickEffect = config.clickEffect;
  if (!clickEffect?.enabled) return null;
  const themeColor = theme.palette.primary.main;
  const type = clickEffect.type || 'heart';
  switch (type) {
    case 'heart':
      return <HeartEffect config={clickEffect} themeColor={themeColor} />;
    case 'ripple':
      return <RippleEffect config={clickEffect} themeColor={themeColor} />;
    case 'bubble':
      return <BubbleEffect config={clickEffect} themeColor={themeColor} />;
    case 'text':
      return <TextEffect config={clickEffect} themeColor={themeColor} />;
    case 'firework':
      return <FireworkEffect config={clickEffect} themeColor={themeColor} />;
    case 'star':
      return <StarEffect config={clickEffect} themeColor={themeColor} />;
    case 'confetti':
      return <ConfettiEffect config={clickEffect} themeColor={themeColor} />;
    default:
      return null;
  }
});