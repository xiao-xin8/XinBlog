import { Box, Typography, alpha } from '@mui/material';
import { useHeroEditContext } from '@/components/Hero/HeroEditContext';
import type { HeroWidgetConfig } from '@/types';

interface ImageWidgetPropsFromConfig {
  src?: string;
  title?: string;
  url?: string;
  objectFit?: 'cover' | 'contain';
}

export function ImageWidget({ config }: { config: HeroWidgetConfig }) {
  const props = (config.props || {}) as ImageWidgetPropsFromConfig;
  const { editable } = useHeroEditContext();
  const src = props.src || '';
  const title = props.title || '';
  const url = props.url || '';
  const objectFit = props.objectFit || 'cover';

  
  const { w, h } = config;
  const isTiny = w === 1 && h === 1;
  const isWide = h === 1 && w >= 2;
  const isCompact = (w === 2 && h === 2) || isWide;
  const isLarge = w >= 3 && h >= 2;
  const titleVariant = isTiny ? 'caption' : isCompact ? 'caption' : isLarge ? 'h6' : 'body2';
  const showTitle = !!title && !isTiny;

  const content = (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'action.hover',
      }}
    >
      {src ? (
        <Box
          component="img"
          src={src}
          alt={title}
          sx={{
            width: '100%',
            height: '100%',
            objectFit,
            transition: (theme) => theme.transitions.create('transform', { duration: theme.transitions.duration.standard }),
            '&:hover': { transform: 'scale(1.04)' },
          }}
        />
      ) : (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'text.secondary',
            p: 2,
            textAlign: 'center',
          }}
        >
          <Typography variant="body2">请配置图片地址</Typography>

        </Box>

      )}
      {showTitle && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            p: isCompact ? 1 : 1.5,
            background: (theme) =>
              `linear-gradient(to top, ${alpha(theme.palette.common.black, 0.6)}, transparent)`,
          }}
        >
          <Typography variant={titleVariant as 'body2' | 'caption' | 'h6'} sx={{ color: '#fff', fontWeight: 700, overflowWrap: 'break-word' }}>
            {title}
          </Typography>

        </Box>

      )}
    </Box>

  );

  if (url && !editable) {
    return (
      <Box component="a" href={url} target="_blank" rel="noopener noreferrer" sx={{ display: 'block', width: '100%', height: '100%', textDecoration: 'none' }}>
        {content}
      </Box>

    );
  }

  return content;
}
