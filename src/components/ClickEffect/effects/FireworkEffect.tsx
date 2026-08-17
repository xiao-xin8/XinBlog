import { useEffect, useRef } from 'react';
import type { ClickEffectConfig } from '@/types';
import { resolveEffectColors } from '../utils/colors';

interface Spark {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

let sparkId = 0;

export function FireworkEffect({ config, themeColor }: { config: ClickEffectConfig; themeColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const count = config.intensity === 'high' ? 28 : config.intensity === 'low' ? 14 : 20;

    const handleClick = (e: MouseEvent) => {
      const colors = resolveEffectColors(config.colorMode, config.customColor, themeColor, count);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
        const speed = 2 + Math.random() * 4;
        sparksRef.current.push({
          id: sparkId++,
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          maxLife: 1,
          size: 2 + Math.random() * 3,
          color: colors[i % colors.length],
        });
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let i = sparksRef.current.length - 1; i >= 0; i--) {
        const s = sparksRef.current[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.12;
        s.vx *= 0.96;
        s.vy *= 0.96;
        s.life -= 0.015;

        ctx.save();
        ctx.globalAlpha = Math.max(0, s.life);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (s.life <= 0) {
          sparksRef.current.splice(i, 1);
        }
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    animate();

    window.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('click', handleClick);
      cancelAnimationFrame(rafRef.current);
    };
  }, [config.colorMode, config.customColor, config.intensity, themeColor]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
      aria-hidden="true"
    />
  );
}
