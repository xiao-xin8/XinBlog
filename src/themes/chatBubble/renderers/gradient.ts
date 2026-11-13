import type { ChatBubbleRenderer } from './base';
import { resolveThemeColor, bubbleRadius } from './base';

/** 渐变彩色：自己对角渐变，对方浅色渐变 */
export const gradientBubbleRenderer: ChatBubbleRenderer<{
  mineStart: string;
  mineEnd: string;
  mineText: string;
  otherStart: string;
  otherEnd: string;
  otherText: string;
  radius: number;
  imageRadius: number;
  mineSharpCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  otherSharpCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}> = {
  id: 'gradient',
  name: '渐变彩色',
  description: '明快的对角渐变气泡',
  defaultParams: {
    mineStart: '#ff7e5f',
    mineEnd: '#feb47b',
    mineText: '#ffffff',
    otherStart: '#ffe9da',
    otherEnd: '#ffd1e8',
    otherText: '#7a4a3b',
    radius: 20,
    imageRadius: 14,
    mineSharpCorner: 'top-right',
    otherSharpCorner: 'top-left',
  },
  schema: [],
  render: (params, { themeColor, borderRadius }) => {
    const radius = Math.min(28, params.radius || borderRadius || 20);
    const imageRadius = Math.min(28, params.imageRadius || radius - 2);
    const mineStart = resolveThemeColor(params.mineStart, themeColor || '#5b7cfa');
    const mineEnd = resolveThemeColor(params.mineEnd, '');
    const otherStart = resolveThemeColor(params.otherStart, 'rgba(0,0,0,0.06)');
    const otherEnd = resolveThemeColor(params.otherEnd, 'rgba(0,0,0,0.02)');
    const background = (a: string, b: string) => `linear-gradient(135deg, ${a} 0%, ${b || a} 100%)`;
    const mine = bubbleRadius(params.mineSharpCorner, radius);
    const other = bubbleRadius(params.otherSharpCorner, radius);

    return {
      mine: {
        backgroundImage: background(mineStart, mineEnd),
        color: params.mineText || '#ffffff',
        borderRadius: `${mine['top-left']}px ${mine['top-right']}px ${mine['bottom-right']}px ${mine['bottom-left']}px`,
        border: 'none',
      },
      other: {
        backgroundImage: background(otherStart, otherEnd),
        color: params.otherText || undefined,
        borderRadius: `${other['top-left']}px ${other['top-right']}px ${other['bottom-right']}px ${other['bottom-left']}px`,
        border: 'none',
      },
      mineImage: { borderRadius: `${imageRadius}px` },
      otherImage: { borderRadius: `${imageRadius}px` },
    };
  },
};