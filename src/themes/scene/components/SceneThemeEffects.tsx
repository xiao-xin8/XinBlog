import { memo } from 'react';
import { Box } from '@mui/material';
import { useSiteStore } from '@/stores/siteStore';
import { getSceneThemeRenderer } from '@/themes/scene/renderers';





export const SceneThemeEffects = memo(function SceneThemeEffects() {
  const { config } = useSiteStore();
  const sceneTheme = config.sceneTheme;
  const renderer = getSceneThemeRenderer(sceneTheme?.variant);

  if (!renderer || sceneTheme?.variant === 'default') {
    return null;
  }

  const params = { ...renderer.defaultParams, ...(sceneTheme?.params || {}) };
  const EffectComponent = renderer.component;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: -1,
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      <EffectComponent params={params} />
    </Box>
  );
});
