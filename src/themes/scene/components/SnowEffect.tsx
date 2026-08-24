import { useEffect, useState } from 'react';
import { Box } from '@mui/material';

interface Snowflake {
  id: number;
  left: string;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

export interface SnowEffectParams {
  [key: string]: unknown;
  count?: number;
  color?: string;
  minSize?: number;
  maxSize?: number;
  minDuration?: number;
  maxDuration?: number;
}

export function SnowEffect({ params }: { params: SnowEffectParams }) {
  const {
    count = 60,
    color = '#ffffff',
    minSize = 2,
    maxSize = 6,
    minDuration = 5,
    maxDuration = 12,
  } = params;

  const [flakes, setFlakes] = useState<Snowflake[]>([]);

  useEffect(() => {
    const generated = Array.from({ length: Math.max(1, Math.min(count, 120)) }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: minSize + Math.random() * (maxSize - minSize),
      duration: minDuration + Math.random() * (maxDuration - minDuration),
      delay: Math.random() * -maxDuration,
      opacity: 0.4 + Math.random() * 0.6,
    }));
    setFlakes(generated);
  }, [count, minSize, maxSize, minDuration, maxDuration]);

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
        '@keyframes snowFall': {
          '0%': {
            transform: 'translateY(-10vh) translateX(0)',
            opacity: 0,
          },
          '10%': {
            opacity: 1,
          },
          '90%': {
            opacity: 0.8,
          },
          '100%': {
            transform: 'translateY(110vh) translateX(20px)',
            opacity: 0,
          },
        },
      }}
    >
      {flakes.map((f) => (
        <Box
          key={f.id}
          sx={{
            position: 'absolute',
            top: 0,
            left: f.left,
            width: f.size,
            height: f.size,
            borderRadius: '50%',
            backgroundColor: color,
            opacity: f.opacity,
            boxShadow: `0 0 ${f.size * 2}px ${color}66`,
            animation: `snowFall ${f.duration}s linear infinite`,
            animationDelay: `${f.delay}s`,
          }}
        />
      ))}
    </Box>

  );
}
