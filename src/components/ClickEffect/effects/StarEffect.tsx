import { useEffect, useRef } from 'react';
import type { ClickEffectConfig } from '@/types';
import { resolveEffectColors } from '../utils/colors';
interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
  scale: number;
  rotation: number;
  vx: number;
  vy: number;
}
let starId = 0;
export function StarEffect({ config, themeColor }: { config: ClickEffectConfig; themeColor: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const starsRef = useRef<Star[]>([]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const count = config.intensity === 'high' ? 10 : config.intensity === 'low' ? 4 : 6;
    const handleClick = (e: MouseEvent) => {
      const colors = resolveEffectColors(config.colorMode, config.customColor, themeColor, count);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const speed = 0.5 + Math.random() * 1.5;
        const star: Star = {
          id: starId++,
          x: e.clientX,
          y: e.clientY,
          size: 12 + Math.random() * 12,
          color: colors[i],
          opacity: 1,
          scale: 0.5 + Math.random() * 0.6,
          rotation: Math.random() * 360,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1,
        };
        starsRef.current.push(star);
        const el = document.createElement('div');
        el.innerHTML = '★';
        el.style.position = 'fixed';
        el.style.left = `${star.x}px`;
        el.style.top = `${star.y}px`;
        el.style.transform = `translate(-50%, -50%) rotate(${star.rotation}deg) scale(${star.scale})`;
        el.style.color = star.color;
        el.style.fontSize = `${star.size}px`;
        el.style.pointerEvents = 'none';
        el.style.zIndex = '9999';
        el.style.textShadow = `0 0 10px ${star.color}`;
        el.setAttribute('data-id', String(star.id));
        container.appendChild(el);
      }
    };
    let raf = 0;
    const animate = () => {
      for (let i = starsRef.current.length - 1; i >= 0; i--) {
        const s = starsRef.current[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.04;
        s.rotation += 4;
        s.opacity -= 0.012;
        const el = container.querySelector(`[data-id="${s.id}"]`) as HTMLElement | null;
        if (el) {
          el.style.left = `${s.x}px`;
          el.style.top = `${s.y}px`;
          el.style.opacity = String(s.opacity);
          el.style.transform = `translate(-50%, -50%) rotate(${s.rotation}deg) scale(${s.scale})`;
        }
        if (s.opacity <= 0) {
          if (el) el.remove();
          starsRef.current.splice(i, 1);
        }
      }
      raf = requestAnimationFrame(animate);
    };
    animate();
    window.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('click', handleClick);
      cancelAnimationFrame(raf);
      container.innerHTML = '';
      starsRef.current = [];
    };
  }, [config.colorMode, config.customColor, config.intensity, themeColor]);
  return (
    <div
      ref={containerRef}
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