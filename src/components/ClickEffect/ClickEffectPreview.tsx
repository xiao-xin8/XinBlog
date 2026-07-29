import { useRef, useCallback } from 'react';
import { Box } from '@mui/material';
import type { ClickEffectConfig } from '@/types';
import { resolveEffectColor, resolveEffectColors } from './utils/colors';
interface ClickEffectPreviewProps {
  config: ClickEffectConfig;
  themeColor: string;
}
export function ClickEffectPreview({ config, themeColor }: ClickEffectPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const spawn = useCallback(
    (e: React.MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      switch (config.type) {
        case 'heart':
          spawnHeart(container, x, y, config, themeColor);
          break;
        case 'bubble':
          spawnBubble(container, x, y, config, themeColor);
          break;
        case 'text':
          spawnText(container, x, y, config, themeColor);
          break;
        case 'star':
          spawnStar(container, x, y, config, themeColor);
          break;
        case 'ripple':
          spawnRipple(container, x, y, config, themeColor);
          break;
        case 'firework':
          spawnFirework(container, x, y, config, themeColor);
          break;
        case 'confetti':
          spawnConfetti(container, x, y, config, themeColor);
          break;
        default:
          break;
      }
    },
    [config, themeColor]
  );
  return (
    <Box
      ref={containerRef}
      onClick={spawn}
      sx={{
        position: 'relative',
        width: '100%',
        height: 160,
        borderRadius: 2,
        overflow: 'hidden',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    />
  );
}
function createParticle(container: HTMLDivElement) {
  const el = document.createElement('div');
  el.style.position = 'absolute';
  el.style.pointerEvents = 'none';
  container.appendChild(el);
  return el;
}
function spawnHeart(
  container: HTMLDivElement,
  x: number,
  y: number,
  config: ClickEffectConfig,
  themeColor: string
) {
  const count = config.intensity === 'high' ? 5 : config.intensity === 'low' ? 2 : 3;
  const colors = resolveEffectColors(config.colorMode, config.customColor, themeColor, count);
  for (let i = 0; i < count; i++) {
    const el = createParticle(container);
    const size = 14 + Math.random() * 10;
    el.innerHTML =
      '<svg viewBox="0 0 24 24" fill="currentColor" style="width:100%;height:100%;"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.color = colors[i];
    el.style.transform = 'translate(-50%, -50%) scale(0.6)';
    el.style.transition = 'all 1.2s ease-out';
    el.style.opacity = '1';
    requestAnimationFrame(() => {
      el.style.transform = `translate(-50%, -120%) rotate(${(Math.random() - 0.5) * 60}deg) scale(1.1)`;
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 1200);
  }
}
function spawnBubble(
  container: HTMLDivElement,
  x: number,
  y: number,
  config: ClickEffectConfig,
  themeColor: string
) {
  const count = config.intensity === 'high' ? 8 : config.intensity === 'low' ? 4 : 6;
  const colors = resolveEffectColors(config.colorMode, config.customColor, themeColor, count);
  for (let i = 0; i < count; i++) {
    const el = createParticle(container);
    const size = 12 + Math.random() * 14;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.borderRadius = '50%';
    el.style.border = `2px solid ${colors[i]}`;
    el.style.transform = 'translate(-50%, -50%)';
    el.style.transition = 'all 1.4s ease-out';
    el.style.opacity = '0.8';
    requestAnimationFrame(() => {
      el.style.transform = `translate(calc(-50% + ${(Math.random() - 0.5) * 60}px), -160%)`;
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 1400);
  }
}
function spawnText(
  container: HTMLDivElement,
  x: number,
  y: number,
  config: ClickEffectConfig,
  themeColor: string
) {
  const list = config.textList?.length ? config.textList : ['❤'];
  const text = list[Math.floor(Math.random() * list.length)];
  const color = resolveEffectColor(config.colorMode, config.customColor, themeColor);
  const el = createParticle(container);
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.color = color;
  el.style.fontSize = '16px';
  el.style.fontWeight = '700';
  el.style.whiteSpace = 'nowrap';
  el.style.transform = 'translate(-50%, -50%) scale(1)';
  el.style.transition = 'all 1.2s ease-out';
  el.style.opacity = '1';
  requestAnimationFrame(() => {
    el.style.transform = 'translate(-50%, -140%) scale(1.1)';
    el.style.opacity = '0';
  });
  setTimeout(() => el.remove(), 1200);
}
function spawnStar(
  container: HTMLDivElement,
  x: number,
  y: number,
  config: ClickEffectConfig,
  themeColor: string
) {
  const count = config.intensity === 'high' ? 10 : config.intensity === 'low' ? 4 : 6;
  const colors = resolveEffectColors(config.colorMode, config.customColor, themeColor, count);
  for (let i = 0; i < count; i++) {
    const el = createParticle(container);
    const angle = (Math.PI * 2 * i) / count;
    const dist = 40 + Math.random() * 40;
    const size = 14 + Math.random() * 10;
    el.textContent = '★';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.color = colors[i];
    el.style.fontSize = `${size}px`;
    el.style.textShadow = `0 0 8px ${colors[i]}`;
    el.style.transform = 'translate(-50%, -50%) rotate(0deg)';
    el.style.transition = 'all 1s ease-out';
    el.style.opacity = '1';
    requestAnimationFrame(() => {
      el.style.transform = `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) rotate(180deg)`;
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 1000);
  }
}
function spawnRipple(
  container: HTMLDivElement,
  x: number,
  y: number,
  config: ClickEffectConfig,
  themeColor: string
) {
  const color = resolveEffectColor(config.colorMode, config.customColor, themeColor);
  const el = createParticle(container);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.width = '0px';
  el.style.height = '0px';
  el.style.borderRadius = '50%';
  el.style.border = `2px solid ${color}`;
  el.style.transform = 'translate(-50%, -50%)';
  el.style.transition = 'all 0.8s ease-out';
  el.style.opacity = '0.6';
  el.style.boxShadow = `0 0 15px ${color}`;
  requestAnimationFrame(() => {
    el.style.width = '120px';
    el.style.height = '120px';
    el.style.opacity = '0';
  });
  setTimeout(() => el.remove(), 800);
}
function spawnFirework(
  container: HTMLDivElement,
  x: number,
  y: number,
  config: ClickEffectConfig,
  themeColor: string
) {
  const count = config.intensity === 'high' ? 28 : config.intensity === 'low' ? 14 : 20;
  const colors = resolveEffectColors(config.colorMode, config.customColor, themeColor, count);
  for (let i = 0; i < count; i++) {
    const el = createParticle(container);
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
    const dist = 30 + Math.random() * 50;
    const size = 4 + Math.random() * 4;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.borderRadius = '50%';
    el.style.background = colors[i % colors.length];
    el.style.transform = 'translate(-50%, -50%)';
    el.style.transition = 'all 0.9s ease-out';
    el.style.opacity = '1';
    requestAnimationFrame(() => {
      el.style.transform = `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px))`;
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 900);
  }
}
function spawnConfetti(
  container: HTMLDivElement,
  x: number,
  y: number,
  config: ClickEffectConfig,
  themeColor: string
) {
  const count = config.intensity === 'high' ? 24 : config.intensity === 'low' ? 12 : 16;
  const colors = resolveEffectColors(config.colorMode, config.customColor, themeColor, count);
  for (let i = 0; i < count; i++) {
    const el = createParticle(container);
    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 60;
    const w = 6 + Math.random() * 6;
    const h = 3 + Math.random() * 4;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.background = colors[i];
    el.style.transform = 'translate(-50%, -50%) rotate(0deg)';
    el.style.transition = 'all 1s ease-out';
    el.style.opacity = '1';
    requestAnimationFrame(() => {
      el.style.transform = `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) rotate(${Math.random() * 360}deg)`;
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 1000);
  }
}