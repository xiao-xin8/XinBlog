import type { ChatBubbleRenderer } from './base';
import { resolveThemeColor, bubbleRadius, resolveImageRadius, type BubbleCorners } from './base';

interface TicketParams extends Record<string, unknown> {
  mineBg: string;
  mineText: string;
  otherBg: string;
  otherText: string;
  radius: number;
  imageRadius: number;
  mineSharpCorner: BubbleCorners;
  otherSharpCorner: BubbleCorners;
}

/** 票据气泡：暖色底 + 深色虚线描边，像一张入场券/票据 */
export const ticketBubbleRenderer: ChatBubbleRenderer<TicketParams> = {
  id: 'ticket',
  name: '票据',
  description: '票据风：暖底 + 撕边虚线描边',
  defaultParams: {
    mineBg: '#fff1d6',
    mineText: '#8a5a1e',
    otherBg: '#f4f5f7',
    otherText: '#444950',
    radius: 16,
    imageRadius: 12,
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
  render: (params, { themeColor, borderRadius }) => {
    const radius = Math.min(28, params.radius || borderRadius || 16);
    const imageRadius = resolveImageRadius(params.imageRadius, radius);
    const mineBg = resolveThemeColor(params.mineBg, themeColor || '#5b7cfa');
    const mineText = resolveThemeColor(params.mineText, '#ffffff');
    const otherBg = resolveThemeColor(params.otherBg, 'rgba(0,0,0,0.06)');
    const otherText = resolveThemeColor(params.otherText, '');
    const mine = bubbleRadius(params.mineSharpCorner, radius);
    const other = bubbleRadius(params.otherSharpCorner, radius);

    return {
      mine: {
        backgroundColor: mineBg,
        color: mineText,
        borderRadius: `${mine['top-left']}px ${mine['top-right']}px ${mine['bottom-right']}px ${mine['bottom-left']}px`,
        border: `2px dashed rgba(138,90,30,0.45)`,
      },
      other: {
        backgroundColor: otherBg,
        color: otherText || undefined,
        borderRadius: `${other['top-left']}px ${other['top-right']}px ${other['bottom-right']}px ${other['bottom-left']}px`,
        border: 'none',
      },
      mineImage: { borderRadius: `${imageRadius}px` },
      otherImage: { borderRadius: `${imageRadius}px` },
    };
  },
};