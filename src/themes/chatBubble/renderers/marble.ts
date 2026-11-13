import type { ChatBubbleRenderer } from './base';
import { resolveThemeColor, bubbleRadius, resolveImageRadius, type BubbleCorners } from './base';

interface MarbleParams extends Record<string, unknown> {
  mineText: string;
  otherText: string;
  radius: number;
  imageRadius: number;
  mineSharpCorner: BubbleCorners;
  otherSharpCorner: BubbleCorners;
}

/** 石纹：近白底 + 极淡理石灰纹，低调质感 */
export const marbleBubbleRenderer: ChatBubbleRenderer<MarbleParams> = {
  id: 'marble',
  name: '石纹',
  description: '理石质感：近白 + 淡灰斑驳纹理',
  defaultParams: {
    mineText: '#374151',
    otherText: '#6b7280',
    radius: 14,
    imageRadius: 10,
    mineSharpCorner: 'top-right',
    otherSharpCorner: 'top-left',
  },
  schema: [
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
  render: (params, { themeColor, borderRadius }) => {
    const radius = Math.min(28, params.radius || borderRadius || 14);
    const imageRadius = resolveImageRadius(params.imageRadius, radius);
    const mine = bubbleRadius(params.mineSharpCorner, radius);
    const other = bubbleRadius(params.otherSharpCorner, radius);
    const base = themeColor || '#5b7cfa';
    const mineText = resolveThemeColor(params.mineText, '#374151');
    const otherText = resolveThemeColor(params.otherText, '#6b7280');

    const veins = (tint: string) => `
      radial-gradient(ellipse at 20% 15%, ${tint}15 0%, transparent 60%),
      radial-gradient(ellipse at 80% 70%, ${tint}10 0%, transparent 55%),
      linear-gradient(135deg, #ffffff 0%, #f2f4f7 100%)`;

    return {
      mine: {
        background: veins(base),
        color: mineText,
        border: '1px solid rgba(0,0,0,0.06)',
        borderRadius: `${mine['top-left']}px ${mine['top-right']}px ${mine['bottom-right']}px ${mine['bottom-left']}px`,
      },
      other: {
        background: veins('#9aa0a6'),
        color: otherText,
        border: '1px solid rgba(0,0,0,0.05)',
        borderRadius: `${other['top-left']}px ${other['top-right']}px ${other['bottom-right']}px ${other['bottom-left']}px`,
      },
      mineImage: { borderRadius: `${imageRadius}px` },
      otherImage: { borderRadius: `${imageRadius}px` },
    };
  },
};