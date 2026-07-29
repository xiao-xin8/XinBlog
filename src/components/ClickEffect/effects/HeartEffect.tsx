import { useEffect, useRef } from 'react';
import type { ClickEffectConfig } from '@/types';
import { resolveEffectColors } from '../utils/colors';
interface Heart {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
  scale: number;
  rotation: number;
}
let heartId = 0;
export function HeartEffect({ config, themeColor }: { config: ClickEffectConfig; themeColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heartsRef = useRef<Heart[]>([]);
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
    const count = config.intensity === 'high' ? 5 : config.intensity === 'low' ? 2 : 3;
    const handleClick = (e: MouseEvent) => {
      const colors = resolveEffectColors(config.colorMode, config.customColor, themeColor, count);
      for (let i = 0; i < count; i++) {
        heartsRef.current.push({
          id: heartId++,
          x: e.clientX,
          y: e.clientY,
          size: 12 + Math.random() * 10,
          color: colors[i],
          opacity: 1,
          scale: 0.6 + Math.random() * 0.6,
          rotation: (Math.random() - 0.5) * 60,
        });
      }
    };
    const drawHeart = (h: Heart) => {
      const s = h.size * h.scale;
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate((h.rotation * Math.PI) / 180);
      ctx.globalAlpha = h.opacity;
      ctx.fillStyle = h.color;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.3);
      ctx.bezierCurveTo(s * 0.5, -s * 0.8, s, -s * 0.3, 0, s);
      ctx.bezierCurveTo(-s, -s * 0.3, -s * 0.5, -s * 0.8, 0, -s * 0.3);
      ctx.fill();
      ctx.restore();
    };
    const animate = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let i = heartsRef.current.length - 1; i >= 0; i--) {
        const h = heartsRef.current[i];
        h.y -= 1.2;
        h.scale += 0.006;
        h.opacity -= 0.015;
        drawHeart(h);
        if (h.opacity <= 0) {
          heartsRef.current.splice(i, 1);
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