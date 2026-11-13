import type { ChatBubbleRenderer } from './base';
import { resolveThemeColor, bubbleRadius, resolveImageRadius, type BubbleCorners } from './base';

interface GinkgoParams extends Record<string, unknown> {
  mineStroke: string;
  mineText: string;
  otherStroke: string;
  otherText: string;
  radius: number;
  imageRadius: number;
  mineSharpCorner: BubbleCorners;
  otherSharpCorner: BubbleCorners;
}

/**
 * 渐变描边：透明底 + 双色渐变描边，仅用一圈彩色轮廓勾勒气泡，
 * 无填充，轻透优雅（区别于「极简」的单色实线）。
 */
export const gingkoBubbleRenderer: ChatBubbleRenderer<GinkgoParams> = {
  id: 'gingko',
  name: '描边',
  description: '渐变描边：透明底 + 双色渐变轮廓',
  defaultParams: {
    mineStroke: '#a18cd1',
    mineText: '#7a5fd0',
    otherStroke: '#f6d365',
    otherText: '#b8860b',
    radius: 16,
    imageRadius: 10,
    mineSharpCorner: 'top-right',
    otherSharpCorner: 'top-left',
  },
  schema: [
    { key: 'mineStroke', label: '自己描边色', type: 'color' },
    { key: 'mineText', label: '自己文字颜色', type: 'color' },
    { key: 'otherStroke', label: '对方描边色', type: 'color' },
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
    const radius = Math.min(28, params.radius || borderRadius || 16);
    const imageRadius = resolveImageRadius(params.imageRadius, radius);
    const mine = bubbleRadius(params.mineSharpCorner, radius);
    const other = bubbleRadius(params.otherSharpCorner, radius);
    const c1 = resolveThemeColor(params.mineStroke, themeColor || '#a18cd1');
    const c2 = resolveThemeColor(params.otherStroke, '#f6d365');
    const mineText = resolveThemeColor(params.mineText, c1);
    const otherText = resolveThemeColor(params.otherText, c2);

    const stroke = (a: string, b: string) =>
      `linear-gradient(135deg, ${a} 0%, ${b} 100%) border-box`;

    return {
      mine: {
        backgroundColor: 'transparent',
        color: mineText,
        borderRadius: `${mine['top-left']}px ${mine['top-right']}px ${mine['bottom-right']}px ${mine['bottom-left']}px`,
        border: `1.5px solid transparent`,
        background: stroke(c1, c2),
        backgroundOrigin: 'border-box',
        backgroundClip: 'border-box',
      },
      other: {
        backgroundColor: 'transparent',
        color: otherText,
        borderRadius: `${other['top-left']}px ${other['top-right']}px ${other['bottom-right']}px ${other['bottom-left']}px`,
        border: `1.5px solid ${c2}`,
      },
      mineImage: { borderRadius: `${imageRadius}px`, border: `1px solid ${c1}22` },
      otherImage: { borderRadius: `${imageRadius}px` },
    };
  },
};