import type { ChatBubbleRenderer } from './base';
import { resolveThemeColor, bubbleRadius, resolveImageRadius, type BubbleCorners } from './base';

interface StickyParams extends Record<string, unknown> {
  mineBg: string;
  mineText: string;
  otherBg: string;
  otherText: string;
  radius: number;
  imageRadius: number;
  mineSharpCorner: BubbleCorners;
  otherSharpCorner: BubbleCorners;
}

/** 手账便签：浅色底 + 右下角折角 + 轻投影，像贴在手账上的便利贴 */
export const stickyBubbleRenderer: ChatBubbleRenderer<StickyParams> = {
  id: 'sticky',
  name: '手账',
  description: '手账便签：浅色 + 右下折角 + 轻投影',
  defaultParams: {
    mineBg: '#fff9c4',
    mineText: '#5d534a',
    otherBg: '#fafafa',
    otherText: '#5f6368',
    radius: 8,
    imageRadius: 6,
    mineSharpCorner: 'top-right',
    otherSharpCorner: 'top-left',
  },
  schema: [
    { key: 'mineBg', label: '自己便签底色', type: 'color' },
    { key: 'mineText', label: '自己文字颜色', type: 'color' },
    { key: 'otherBg', label: '对方背景色', type: 'color' },
    { key: 'otherText', label: '对方文字颜色', type: 'color' },
    { key: 'radius', label: '气泡圆角', type: 'number', min: 4, max: 20, step: 1 },
    { key: 'imageRadius', label: '图片圆角', type: 'number', min: 4, max: 28, step: 1 },
    { key: 'mineSharpCorner', label: '自己气泡尖角', type: 'select', options: [
      { value: 'top-right', label: '右上' }, { value: 'top-left', label: '左上' },
      { value: 'bottom-right', label: '右下' }, { value: 'bottom-left', label: '左下' } ] },
    { key: 'otherSharpCorner', label: '对方气泡尖角', type: 'select', options: [
      { value: 'top-left', label: '左上' }, { value: 'top-right', label: '右上' },
      { value: 'bottom-left', label: '左下' }, { value: 'bottom-right', label: '右下' } ] },
  ],
  render: (params, { borderRadius }) => {
    const radius = Math.min(20, params.radius || borderRadius || 8);
    const imageRadius = resolveImageRadius(params.imageRadius, Math.max(radius, 6));
    const mineBg = resolveThemeColor(params.mineBg, '#fff9c4');
    const mineText = resolveThemeColor(params.mineText, '#5d534a');
    const otherBg = resolveThemeColor(params.otherBg, '#fafafa');
    const otherText = resolveThemeColor(params.otherText, '#5f6368');
    const mine = bubbleRadius(params.mineSharpCorner, radius);
    const other = bubbleRadius(params.otherSharpCorner, radius);

    return {
      mine: {
        backgroundColor: mineBg,
        color: mineText,
        borderRadius: `${mine['top-left']}px ${mine['top-right']}px ${mine['bottom-right']}px ${mine['bottom-left']}px`,
        boxShadow: '2px 3px 6px rgba(0,0,0,0.12)',
        border: 'none',
        // 右下折角：用渐变切出的三角
        background: `linear-gradient(135deg, ${mineBg} 0%, ${mineBg} 78%, rgba(0,0,0,0.12) 78%, rgba(0,0,0,0.06) 92%, transparent 92%), ${mineBg}`,
      },
      other: {
        backgroundColor: otherBg,
        color: otherText,
        borderRadius: `${other['top-left']}px ${other['top-right']}px ${other['bottom-right']}px ${other['bottom-left']}px`,
        boxShadow: '1px 2px 4px rgba(0,0,0,0.08)',
        border: 'none',
      },
      mineImage: { borderRadius: `${imageRadius}px` },
      otherImage: { borderRadius: `${imageRadius}px` },
    };
  },
};