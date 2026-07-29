import { Box, useTheme } from '@mui/material';
export interface OceanEffectParams {
  [key: string]: unknown;
  waveColor?: string;
  secondaryColor?: string;
  speed?: number;
  opacity?: number;
}
export function OceanEffect({ params }: { params: OceanEffectParams }) {
  const theme = useTheme();
  const {
    waveColor = '#06b6d4',
    secondaryColor = '#3b82f6',
    speed = 8,
    opacity = 0.18,
  } = params;
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
        background: `linear-gradient(180deg, ${theme.palette.background.default} 0%, ${waveColor}22 100%)`,
        opacity,
        '@keyframes oceanWave': {
          '0%': {
            transform: 'translateX(-25%) skewX(-8deg)',
          },
          '50%': {
            transform: 'translateX(0%) skewX(0deg)',
          },
          '100%': {
            transform: 'translateX(-25%) skewX(-8deg)',
          },
        },
      }}
    >
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            bottom: `${-10 + i * 8}%`,
            left: 0,
            width: '200%',
            height: '40%',
            borderRadius: '50%',
            background: `radial-gradient(ellipse at center, ${waveColor}${Math.round(
              (0.4 - i * 0.1) * 255
            ).toString(16)} 0%, transparent 70%)`,
            animation: `oceanWave ${speed + i * 2}s ease-in-out infinite`,
            animationDelay: `${i * 0.8}s`,
            transformOrigin: 'center bottom',
          }}
        />
      ))}
      <Box
        sx={{
          position: 'absolute',
          top: '10%',
          right: '10%',
          width: '30%',
          height: '30%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${secondaryColor}33 0%, transparent 70%)`,
          filter: 'blur(40px)',
        }}
      />
    </Box>
  );
}