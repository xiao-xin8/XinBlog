import type { ChatBubbleRenderer } from './base';
import { resolveThemeColor, bubbleRadius, resolveImageRadius, type BubbleCorners } from './base';

interface DarkParams extends Record<string, unknown> {
  mineBg: string;
  mineText: string;
  otherBg: string;
  otherText: string;
  radius: number;
  imageRadius: number;
  mineSharpCorner: BubbleCorners;
  otherSharpCorner: BubbleCorners;
}

/** 酷黑白夜：近黑实底 + 白字，高对比夜聊反转风 */
export const darkBubbleRenderer: ChatBubbleRenderer<DarkParams> = {
  id: 'dark',
  name: '酷黑',
  description: '暗夜反转：近黑实底 + 亮字，昼夜分明',
  defaultParams: {
    mineBg: '#111318',
    mineText: '#f5f5f5',
    otherBg: '#26282e',
    otherText: '#e0e0e0',
    radius: 16,
    imageRadius: 10,
    mineSharpCorner: 'top-right',
    otherSharpCorner: 'top-left',
  },
  schema: [
    { key: 'mineBg', label: '自己气泡背景色', type: 'color' },
    { key: 'mineText', label: '自己文字颜色', type: 'color' },
    { key: 'otherBg', label: '对方气泡背景色', type: 'color' },
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
    const radius = Math.min(28, params.radius || borderRadius || 16);
    const imageRadius = resolveImageRadius(params.imageRadius, radius);
    const mineBg = resolveThemeColor(params.mineBg, '#111318');
    const mineText = resolveThemeColor(params.mineText, '#f5f5f5');
    const otherBg = resolveThemeColor(params.otherBg, '#26282e');
    const otherText = resolveThemeColor(params.otherText, '#e0e0e0');
    const mine = bubbleRadius(params.mineSharpCorner, radius);
    const other = bubbleRadius(params.otherSharpCorner, radius);

    return {
      mine: {
        backgroundColor: mineBg,
        color: mineText,
        borderRadius: `${mine['top-left']}px ${mine['top-right']}px ${mine['bottom-right']}px ${mine['bottom-left']}px`,
        border: 'none',
      },
      other: {
        backgroundColor: otherBg,
        color: otherText,
        borderRadius: `${other['top-left']}px ${other['top-right']}px ${other['bottom-right']}px ${other['bottom-left']}px`,
        border: 'none',
      },
      mineImage: { borderRadius: `${imageRadius}px` },
      otherImage: { borderRadius: `${imageRadius}px` },
    };
  },
};