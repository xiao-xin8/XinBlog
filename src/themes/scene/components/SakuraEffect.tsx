import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
interface Petal {
  id: number;
  left: string;
  size: number;
  duration: number;
  delay: number;
  rotation: number;
}
export interface SakuraEffectParams {
  [key: string]: unknown;
  count?: number;
  color?: string;
  minSize?: number;
  maxSize?: number;
  minDuration?: number;
  maxDuration?: number;
}
export function SakuraEffect({ params }: { params: SakuraEffectParams }) {
  const {
    count = 40,
    color = '#f9a8d4',
    minSize = 8,
    maxSize = 20,
    minDuration = 6,
    maxDuration = 14,
  } = params;
  const [petals, setPetals] = useState<Petal[]>([]);
  useEffect(() => {
    const generated = Array.from({ length: Math.max(1, Math.min(count, 100)) }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: minSize + Math.random() * (maxSize - minSize),
      duration: minDuration + Math.random() * (maxDuration - minDuration),
      delay: Math.random() * -maxDuration,
      rotation: Math.random() * 360,
    }));
    setPetals(generated);
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
        '@keyframes sakuraFall': {
          '0%': {
            transform: 'translate(0, -10vh) rotate(0deg)',
            opacity: 0,
          },
          '10%': {
            opacity: 0.9,
          },
          '80%': {
            opacity: 0.9,
          },
          '100%': {
            transform: 'translate(15vw, 110vh) rotate(360deg)',
            opacity: 0,
          },
        },
      }}
    >
      {petals.map((p) => (
        <Box
          key={p.id}
          sx={{
            position: 'absolute',
            top: 0,
            left: p.left,
            width: p.size,
            height: p.size * 1.2,
            borderRadius: '100% 0 100% 0',
            backgroundColor: color,
            opacity: 0.75,
            boxShadow: `0 0 5px ${color}`,
            animation: `sakuraFall ${p.duration}s linear infinite`,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </Box>
  );
}