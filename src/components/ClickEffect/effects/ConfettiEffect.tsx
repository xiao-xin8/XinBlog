import { useEffect, useRef } from 'react';
import type { ClickEffectConfig } from '@/types';
import { resolveEffectColors } from '../utils/colors';
interface Confetti {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  opacity: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
}
let confettiId = 0;
export function ConfettiEffect({ config, themeColor }: { config: ClickEffectConfig; themeColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const confettiRef = useRef<Confetti[]>([]);
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
    const count = config.intensity === 'high' ? 24 : config.intensity === 'low' ? 12 : 16;
    const handleClick = (e: MouseEvent) => {
      const colors = resolveEffectColors(config.colorMode, config.customColor, themeColor, count);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 4;
        confettiRef.current.push({
          id: confettiId++,
          x: e.clientX,
          y: e.clientY,
          w: 6 + Math.random() * 6,
          h: 3 + Math.random() * 4,
          color: colors[i],
          opacity: 1,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 12,
        });
      }
    };
    const animate = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let i = confettiRef.current.length - 1; i >= 0; i--) {
        const c = confettiRef.current[i];
        c.x += c.vx;
        c.y += c.vy;
        c.vy += 0.18;
        c.vx *= 0.97;
        c.rotation += c.rotationSpeed;
        c.opacity -= 0.01;
        ctx.save();
        ctx.globalAlpha = Math.max(0, c.opacity);
        ctx.translate(c.x, c.y);
        ctx.rotate((c.rotation * Math.PI) / 180);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
        ctx.restore();
        if (c.opacity <= 0) {
          confettiRef.current.splice(i, 1);
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