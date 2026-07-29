import { useEffect, useRef } from 'react';
import type { ClickEffectConfig } from '@/types';
import { resolveEffectColor } from '../utils/colors';
interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  opacity: number;
  scale: number;
  vy: number;
}
let textId = 0;
export function TextEffect({ config, themeColor }: { config: ClickEffectConfig; themeColor: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textsRef = useRef<FloatingText[]>([]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const list = config.textList?.length ? config.textList : ['❤'];
    let index = 0;
    const handleClick = (e: MouseEvent) => {
      const text = list[index % list.length];
      index++;
      const color = resolveEffectColor(config.colorMode, config.customColor, themeColor);
      const item: FloatingText = {
        id: textId++,
        x: e.clientX,
        y: e.clientY,
        text,
        color,
        opacity: 1,
        scale: 1,
        vy: 1 + Math.random(),
      };
      textsRef.current.push(item);
      const el = document.createElement('div');
      el.textContent = text;
      el.style.position = 'fixed';
      el.style.left = `${item.x}px`;
      el.style.top = `${item.y}px`;
      el.style.transform = 'translate(-50%, -50%) scale(1)';
      el.style.color = color;
      el.style.fontSize = '16px';
      el.style.fontWeight = '700';
      el.style.pointerEvents = 'none';
      el.style.zIndex = '9999';
      el.style.whiteSpace = 'nowrap';
      el.style.userSelect = 'none';
      el.style.textShadow = `0 0 8px ${color}66`;
      el.setAttribute('data-id', String(item.id));
      container.appendChild(el);
    };
    let raf = 0;
    const animate = () => {
      for (let i = textsRef.current.length - 1; i >= 0; i--) {
        const t = textsRef.current[i];
        t.y -= t.vy;
        t.opacity -= 0.012;
        t.scale += 0.005;
        const el = container.querySelector(`[data-id="${t.id}"]`) as HTMLElement | null;
        if (el) {
          el.style.top = `${t.y}px`;
          el.style.opacity = String(t.opacity);
          el.style.transform = `translate(-50%, -50%) scale(${t.scale})`;
        }
        if (t.opacity <= 0) {
          if (el) el.remove();
          textsRef.current.splice(i, 1);
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
      textsRef.current = [];
    };
  }, [config.colorMode, config.customColor, config.textList, themeColor]);
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