import { useEffect, useRef } from 'react';
import type { ClickEffectConfig } from '@/types';
import { resolveEffectColors } from '../utils/colors';

interface Bubble {
  id: number;
  x: number;
  y: number;
  r: number;
  color: string;
  /** 出生时间戳（ms），用于时间驱动的动画 */
  born: number;
  /** 总寿命（ms），所有设备上动画时长一致 */
  lifetime: number;
  /** 上升速度（px/ms） */
  vy: number;
  /** 水平漂移速度（px/ms） */
  vx: number;
  wobble: number;
  /** 摆动角速度（rad/ms） */
  wobbleSpeed: number;
}

let bubbleId = 0;

export function BubbleEffect({ config, themeColor }: { config: ClickEffectConfig; themeColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let last = performance.now();
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      last = performance.now();
    };
    resize();
    window.addEventListener('resize', resize);

    const count = config.intensity === 'high' ? 8 : config.intensity === 'low' ? 4 : 6;

    const handleClick = (e: MouseEvent) => {
      const colors = resolveEffectColors(config.colorMode, config.customColor, themeColor, count);
      const now = performance.now();
      for (let i = 0; i < count; i++) {
        const r = 6 + Math.random() * 12;
        bubblesRef.current.push({
          id: bubbleId++,
          x: e.clientX,
          y: e.clientY,
          r,
          color: colors[i],
          born: now,
          lifetime: 1500 + Math.random() * 500,
          vy: 0.06 + Math.random() * 0.12,
          vx: (Math.random() - 0.5) * 0.02,
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.003 + Math.random() * 0.002,
        });
      }
    };

    const animate = (now: number) => {
      // 时间驱动：用真实时间差计算，避免高刷新率/低帧率下动画快慢不一
      const dt = Math.min(now - last, 50);
      last = now;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let i = bubblesRef.current.length - 1; i >= 0; i--) {
        const b = bubblesRef.current[i];
        const progress = Math.min((now - b.born) / b.lifetime, 1);

        b.y -= b.vy * dt;
        b.x += (Math.sin(b.wobble) * 0.05 + b.vx) * dt;
        b.wobble += b.wobbleSpeed * dt;

        // 缓出曲线：尾部平滑趋近 0，气泡完全透明后才移除，避免"突然显示/消失"
        const fade = 1 - Math.pow(1 - progress, 3);
        const alpha = Math.max(0, 0.8 * (1 - fade));

        ctx.save();
        // 气泡描边
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.stroke();
        // 内层半透明填充，让气泡更柔和、淡出更自然
        ctx.globalAlpha = alpha * 0.12;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 0.85, 0, Math.PI * 2);
        ctx.fill();
        // 高光点
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (progress >= 1) {
          bubblesRef.current.splice(i, 1);
        }
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

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
