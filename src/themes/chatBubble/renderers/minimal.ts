import type { ChatBubbleRenderer } from './base';
import { resolveThemeColor, bubbleRadius } from './base';

/** 极简边框：无填充，仅细边框，文字色用主题文字色 */
export const minimalBubbleRenderer: ChatBubbleRenderer<{
  mineBorder: string;
  mineText: string;
  otherBorder: string;
  otherText: string;
  radius: number;
  imageRadius: number;
  mineSharpCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  otherSharpCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}> = {
  id: 'minimal',
  name: '极简边框',
  description: '无底色、细边框线框气泡',
  defaultParams: {
    mineBorder: '#ff8a65',
    mineText: '#ff7043',
    otherBorder: '#9aa0a6',
    otherText: '#5f6368',
    radius: 12,
    imageRadius: 8,
    mineSharpCorner: 'top-right',
    otherSharpCorner: 'top-left',
  },
  // 深色：无填充，能看见的只有描边和文字，两者都要够亮才不糊
  darkParams: {
    mineBorder: '#ff9e7a',
    mineText: '#ffc4b0',
    otherBorder: '#b8b8c0',
    otherText: '#d5d5da',
  },
  schema: [
    { key: 'mineBorder', label: '自己描边色', type: 'color' },
    { key: 'mineText', label: '自己文字颜色', type: 'color' },
    { key: 'otherBorder', label: '对方描边色', type: 'color' },
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
    const radius = Math.min(28, params.radius || borderRadius || 12);
    const imageRadius = Math.min(28, params.imageRadius || radius - 2);
    const mineBorder = resolveThemeColor(params.mineBorder, themeColor || '#5b7cfa');
    const otherBorder = resolveThemeColor(params.otherBorder, '');
    const mineText = resolveThemeColor(params.mineText, '');
    const otherText = resolveThemeColor(params.otherText, '');
    const mine = bubbleRadius(params.mineSharpCorner, radius);
    const other = bubbleRadius(params.otherSharpCorner, radius);

    return {
      mine: {
        backgroundColor: 'transparent',
        color: mineText || undefined,
        borderRadius: `${mine['top-left']}px ${mine['top-right']}px ${mine['bottom-right']}px ${mine['bottom-left']}px`,
        border: `1px solid ${mineBorder}`,
      },
      other: {
        backgroundColor: 'transparent',
        color: otherText || undefined,
        borderRadius: `${other['top-left']}px ${other['top-right']}px ${other['bottom-right']}px ${other['bottom-left']}px`,
        border: `1px solid ${otherBorder}`,
      },
      mineImage: { borderRadius: `${imageRadius}px` },
      otherImage: { borderRadius: `${imageRadius}px` },
    };
  },
};