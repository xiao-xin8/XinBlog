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
  // 深色：暖色渐变压暗，对方改深棕灰，文字转浅米色
  darkParams: {
    mineStart: '#c2412f',
    mineEnd: '#7d3f18',
    mineText: '#fff4ec',
    otherStart: '#3a2f2a',
    otherEnd: '#2f2530',
    otherText: '#eadfd7',
  },
  schema: [
    { key: 'mineStart', label: '自己渐变起始色', type: 'color' },
    { key: 'mineEnd', label: '自己渐变结束色', type: 'color' },
    { key: 'mineText', label: '自己文字颜色', type: 'color' },
    { key: 'otherStart', label: '对方渐变起始色', type: 'color' },
    { key: 'otherEnd', label: '对方渐变结束色', type: 'color' },
    { key: 'otherText', label: '对方文字颜色', type: 'color' },
    { key: 'radius', label: '气泡圆角', type: 'number', min: 4, max: 28, step: 1 },
    { key: 'imageRadius', label: '图片圆角', type: 'number', min: 4, max: 28, step: 1 },
    { key: 'mineSharpCorner', label: '自己气泡尖角', type: 'select', options: [
      { value: 'top-right', label: '右上' }, { value: 'top-left', label: '左上' },
      { value: 'bottom-right', label: '右下' }, { value: 'bottom-left', label: '左下' } ] },
    { key: 'otherSharpCorner', label: '对方气泡尖角', type: 'select', options: [
      { value: 'top-left', label: '左上' }, { value: 'top-right', label: '右上' },
      { value: 'bottom-left', label: '左下' }, { value: 'bottom-right', label: '右下' } ] },
  ],
  render: (params, { themeColor, borderRadius }) => {
    const radius = Math.min(28, params.radius || borderRadius || 20);
    const imageRadius = Math.min(28, params.imageRadius || radius - 2);
    const mineStart = resolveThemeColor(params.mineStart, themeColor || '#5b7cfa');
    const mineEnd = resolveThemeColor(params.mineEnd, '');
    const otherStart = resolveThemeColor(params.otherStart, 'rgba(0,0,0,0.06)');
    const otherEnd = resolveThemeColor(params.otherEnd, 'rgba(0,0,0,0.02)');
    const background = (a: string, b: string) => `linear-gradient(135deg, ${a} 0%, ${b || a} 100%)`;
    // 与其他主题保持一致：走 resolveThemeColor，空值/纯黑视为"用默认"，而不是真的涂黑
    const mineText = resolveThemeColor(params.mineText, '#ffffff');
    const otherText = resolveThemeColor(params.otherText, '');
    const mine = bubbleRadius(params.mineSharpCorner, radius);
    const other = bubbleRadius(params.otherSharpCorner, radius);

    return {
      mine: {
        backgroundImage: background(mineStart, mineEnd),
        color: mineText,
        borderRadius: `${mine['top-left']}px ${mine['top-right']}px ${mine['bottom-right']}px ${mine['bottom-left']}px`,
        border: 'none',
      },
      other: {
        backgroundImage: background(otherStart, otherEnd),
        color: otherText || undefined,
        borderRadius: `${other['top-left']}px ${other['top-right']}px ${other['bottom-right']}px ${other['bottom-left']}px`,
        border: 'none',
      },
      mineImage: { borderRadius: `${imageRadius}px` },
      otherImage: { borderRadius: `${imageRadius}px` },
    };
  },
};