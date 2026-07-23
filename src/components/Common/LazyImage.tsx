import { useEffect, useRef, useState } from 'react';
import { Box, alpha } from '@mui/material';
import { keyframes } from '@mui/system';
import { useSiteStore } from '@/stores/siteStore';
import { isMediaUrl } from '@/api/media';

const shimmer = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
`;

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt?: string;
  aspectRatio?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  placeholder?: 'skeleton' | 'color' | 'none';
  rootMargin?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export function LazyImage({
  src,
  alt = '',
  aspectRatio,
  objectFit = 'cover',
  placeholder = 'color',
  rootMargin = '100px',
  onLoad,
  onError,
  style,
  ...rest
}: LazyImageProps) {
  const { config } = useSiteStore();
  const lazyLoadMedia = config.lazyLoadMedia ?? false;
  const isMedia = isMediaUrl(src);
  const shouldLazy = lazyLoadMedia && isMedia;

  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [visible, setVisible] = useState(!shouldLazy);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shouldLazy) {
      setVisible(true);
      return;
    }
    setLoaded(false);
    setError(false);

    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [src, shouldLazy, rootMargin]);

  const handleLoad = () => {
    setLoaded(true);
    setError(false);
    onLoad?.();
  };

  const handleError = () => {
    setError(true);
    setLoaded(true);
    onError?.();
  };

  const showColorPlaceholder = placeholder !== 'none' && !loaded && !error;

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        aspectRatio,
        overflow: 'hidden',
        backgroundColor: (theme) =>
          showColorPlaceholder ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
      }}
    >
      {showColorPlaceholder && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: 0,
              background: (theme) =>
                `linear-gradient(90deg, transparent, ${alpha(
                  theme.palette.background.paper,
                  theme.palette.mode === 'light' ? 0.4 : 0.15
                )}, transparent)`,
              animation: `${shimmer} 1.6s infinite`,
            },
          }}
        />
      )}
      {error && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
          }}
        />
      )}
      {visible && src && !error && (
        <Box
          component="img"
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          sx={{
            width: '100%',
            height: '100%',
            objectFit,
            display: 'block',
            opacity: loaded ? 1 : 0,
            transition: (theme) => theme.transitions.create('opacity', { duration: 600 }),
            ...style,
          }}
          {...rest}
        />
      )}
    </Box>
  );
}
