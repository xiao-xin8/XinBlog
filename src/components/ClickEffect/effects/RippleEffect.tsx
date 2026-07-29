import { useEffect, useRef } from 'react';
import type { ClickEffectConfig } from '@/types';
import { resolveEffectColor } from '../utils/colors';
interface Ripple {
  x: number;
  y: number;
  r: number;
  opacity: number;
  velocity: number;
}
export function RippleEffect({ config, themeColor }: { config: ClickEffectConfig; themeColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ripplesRef = useRef<Ripple[]>([]);
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
    const baseColor = resolveEffectColor(config.colorMode, config.customColor, themeColor);
    const rgb = hexToRgb(baseColor);
    const handleClick = (e: MouseEvent) => {
      ripplesRef.current.push({
        x: e.clientX,
        y: e.clientY,
        r: 0,
        opacity: 0.6,
        velocity: 2.5,
      });
    };
    const animate = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.shadowBlur = 15;
      ctx.shadowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`;
      for (let i = ripplesRef.current.length - 1; i >= 0; i--) {
        const r = ripplesRef.current[i];
        r.r += r.velocity;
        r.velocity *= 0.96;
        r.opacity -= 0.015;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${r.opacity})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${r.opacity * 0.3})`;
        ctx.fill();
        if (r.opacity <= 0) {
          ripplesRef.current.splice(i, 1);
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
  }, [config.colorMode, config.customColor, themeColor]);
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
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  if (clean.length === 3) {
    const r = (bigint >> 8) & 0xf;
    const g = (bigint >> 4) & 0xf;
    const b = bigint & 0xf;
    return { r: r * 17, g: g * 17, b: b * 17 };
  }
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}