import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
interface Firefly {
  id: number;
  top: string;
  left: string;
  size: number;
  breatheDuration: number;
  breatheDelay: number;
  floatDuration: number;
  floatDelay: number;
  floatPath: string;
}
export interface FireflyEffectParams {
  [key: string]: unknown;
  count?: number;
  color?: string;
  minSize?: number;
  maxSize?: number;
}
export function FireflyEffect({ params }: { params: FireflyEffectParams }) {
  const { count = 50, color = '#c8ffc8', minSize = 3, maxSize = 6 } = params;
  const [flies, setFlies] = useState<Firefly[]>([]);
  useEffect(() => {
    const generated: Firefly[] = Array.from({ length: Math.max(1, Math.min(count, 100)) }).map((_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      size: minSize + Math.random() * (maxSize - minSize),
      breatheDuration: 3 + Math.random() * 5,
      breatheDelay: Math.random() * -10,
      floatDuration: 15 + Math.random() * 20,
      floatDelay: Math.random() * -20,
      floatPath: `float${Math.floor(Math.random() * 4) + 1}`,
    }));
    setFlies(generated);
  }, [count, minSize, maxSize]);
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
        mixBlendMode: 'screen',
        '@keyframes fireflyBreathe': {
          '0%, 100%': {
            opacity: 0,
            transform: 'scale(0.3)',
          },
          '50%': {
            opacity: 1,
            transform: 'scale(1.2)',
            boxShadow: `0 0 10px 3px ${color}cc, 0 0 20px 6px ${color}66`,
          },
        },
        '@keyframes float1': {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '33%': { transform: 'translate(10vw, -15vh)' },
          '66%': { transform: 'translate(-5vw, -20vh)' },
        },
        '@keyframes float2': {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '33%': { transform: 'translate(-12vw, 10vh)' },
          '66%': { transform: 'translate(8vw, 15vh)' },
        },
        '@keyframes float3': {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '33%': { transform: 'translate(15vw, 15vh)' },
          '66%': { transform: 'translate(-10vw, 5vh)' },
        },
        '@keyframes float4': {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '33%': { transform: 'translate(-15vw, -10vh)' },
          '66%': { transform: 'translate(10vw, -15vh)' },
        },
      }}
    >
      {flies.map((fly) => (
        <Box
          key={fly.id}
          sx={{
            position: 'absolute',
            top: fly.top,
            left: fly.left,
            animation: `${fly.floatPath} ${fly.floatDuration}s ease-in-out infinite`,
            animationDelay: `${fly.floatDelay}s`,
          }}
        >
          <Box
            sx={{
              width: fly.size,
              height: fly.size,
              borderRadius: '50%',
              backgroundColor: color,
              animation: `fireflyBreathe ${fly.breatheDuration}s ease-in-out infinite`,
              animationDelay: `${fly.breatheDelay}s`,
            }}
          />
        </Box>
      ))}
    </Box>
  );
}