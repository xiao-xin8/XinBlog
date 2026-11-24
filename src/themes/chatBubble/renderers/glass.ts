import type { ChatBubbleRenderer } from './base';
import { resolveThemeColor, bubbleRadius, resolveImageRadius, type BubbleCorners } from './base';

interface GlassParams extends Record<string, unknown> {
  mineTint: string;
  /** 对方气泡通透色，独立于自己（原来两边共用 mineTint，深色下几乎分不清谁是谁） */
  otherTint: string;
  mineText: string;
  otherText: string;
  radius: number;
  imageRadius: number;
  mineSharpCorner: BubbleCorners;
  otherSharpCorner: BubbleCorners;
}

/** 玻璃拟态：半透明磨砂 + 轻微内发光，通透质感 */
export const glassBubbleRenderer: ChatBubbleRenderer<GlassParams> = {
  id: 'glass',
  name: '玻璃',
  description: '玻璃拟态：半透明磨砂 + 通透内光',
  defaultParams: {
    mineTint: 'rgba(255,255,255,0.22)',
    otherTint: 'rgba(255,255,255,0.16)',
    mineText: '#ffffff',
    otherText: '#2f3542',
    radius: 20,
    imageRadius: 14,
    mineSharpCorner: 'top-right',
    otherSharpCorner: 'top-left',
  },
  // 深色：磨砂玻璃改低透明度，避免在暗底上糊成一片浅灰；两边给不同厚度好区分
  darkParams: {
    mineTint: 'rgba(255,255,255,0.14)',
    otherTint: 'rgba(255,255,255,0.07)',
    mineText: '#ffffff',
    otherText: '#e8eaee',
  },
  schema: [
    { key: 'mineTint', label: '自己气泡通透色', type: 'color' },
    { key: 'otherTint', label: '对方气泡通透色', type: 'color' },
    { key: 'mineText', label: '自己文字颜色', type: 'color' },
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
  render: (params, { borderRadius, mode }) => {
    const isDark = mode === 'dark';
    const radius = Math.min(28, params.radius || borderRadius || 20);
    const imageRadius = resolveImageRadius(params.imageRadius, radius);
    const mine = bubbleRadius(params.mineSharpCorner, radius);
    const other = bubbleRadius(params.otherSharpCorner, radius);
    const mineBg = resolveThemeColor(params.mineTint, 'rgba(255,255,255,0.22)');
    const otherBg = resolveThemeColor(params.otherTint, 'rgba(255,255,255,0.16)');

    // 磨砂：两边各自独立底色，避免自己/对方糊成同一块
    const frost = {
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
    };

    return {
      mine: {
        ...frost,
        backgroundColor: mineBg,
        // 深色下白色描边太抢眼，压到 12%
        border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.35)',
        color: resolveThemeColor(params.mineText, '#ffffff'),
        boxShadow: isDark ? 'inset 0 0 18px rgba(255,255,255,0.06)' : 'inset 0 0 18px rgba(255,255,255,0.18)',
        borderRadius: `${mine['top-left']}px ${mine['top-right']}px ${mine['bottom-right']}px ${mine['bottom-left']}px`,
      },
      other: {
        // 对方：更淡一层，比自己的"玻璃"更薄
        ...frost,
        backgroundColor: otherBg,
        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.25)',
        color: resolveThemeColor(params.otherText, '#2f3542'),
        borderRadius: `${other['top-left']}px ${other['top-right']}px ${other['bottom-right']}px ${other['bottom-left']}px`,
      },
      mineImage: { borderRadius: `${imageRadius}px` },
      otherImage: { borderRadius: `${imageRadius}px` },
    };
  },
};