import type { ChatBubbleRenderer } from './base';
import { resolveThemeColor, bubbleRadius, resolveImageRadius, type BubbleCorners } from './base';

interface GlassParams extends Record<string, unknown> {
  mineTint: string;
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
    mineText: '#ffffff',
    otherText: '#2f3542',
    radius: 20,
    imageRadius: 14,
    mineSharpCorner: 'top-right',
    otherSharpCorner: 'top-left',
  },
  schema: [
    { key: 'mineTint', label: '自己气泡通透色', type: 'color' },
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
  render: (params, { borderRadius }) => {
    const radius = Math.min(28, params.radius || borderRadius || 20);
    const imageRadius = resolveImageRadius(params.imageRadius, radius);
    const mine = bubbleRadius(params.mineSharpCorner, radius);
    const other = bubbleRadius(params.otherSharpCorner, radius);
    const mineBg = resolveThemeColor(params.mineTint, 'rgba(255,255,255,0.22)');

    // 通用磨砂边框：需要外层有 bkg，这里用 regular blur
    const frosted = {
      backgroundColor: mineBg,
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      border: '1px solid rgba(255,255,255,0.35)',
    };

    return {
      mine: {
        ...frosted,
        color: resolveThemeColor(params.mineText, '#ffffff'),
        boxShadow: 'inset 0 0 18px rgba(255,255,255,0.18)',
        borderRadius: `${mine['top-left']}px ${mine['top-right']}px ${mine['bottom-right']}px ${mine['bottom-left']}px`,
      },
      other: {
        // 对方：浅白半透明，视觉更轻
        ...frosted,
        color: resolveThemeColor(params.otherText, '#2f3542'),
        borderRadius: `${other['top-left']}px ${other['top-right']}px ${other['bottom-right']}px ${other['bottom-left']}px`,
      },
      mineImage: { borderRadius: `${imageRadius}px` },
      otherImage: { borderRadius: `${imageRadius}px` },
    };
  },
};