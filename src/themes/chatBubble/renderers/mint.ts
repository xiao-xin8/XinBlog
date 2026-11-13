import type { ChatBubbleRenderer } from './base';
import { resolveThemeColor, bubbleRadius, resolveImageRadius, type BubbleCorners } from './base';

interface MintParams extends Record<string, unknown> {
  mineBg: string;
  mineText: string;
  otherBg: string;
  otherText: string;
  radius: number;
  imageRadius: number;
  mineSharpCorner: BubbleCorners;
  otherSharpCorner: BubbleCorners;
}

/** 薄荷：清爽低饱和薄荷绿/奶油，马卡龙般柔和 */
export const mintBubbleRenderer: ChatBubbleRenderer<MintParams> = {
  id: 'mint',
  name: '薄荷',
  description: '薄荷清爽：低饱和薄荷绿/奶油，柔和马卡龙',
  defaultParams: {
    mineBg: '#a3e4dc',
    mineText: '#14532d',
    otherBg: '#f8f3e7',
    otherText: '#5f6368',
    radius: 20,
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
  render: (params, { borderRadius }) => {
    const radius = Math.min(28, params.radius || borderRadius || 20);
    const imageRadius = resolveImageRadius(params.imageRadius, radius);
    const mineBg = resolveThemeColor(params.mineBg, '#a3e4dc');
    const mineText = resolveThemeColor(params.mineText, '#14532d');
    const otherBg = resolveThemeColor(params.otherBg, '#f8f3e7');
    const otherText = resolveThemeColor(params.otherText, '#5f6368');
    const mine = bubbleRadius(params.mineSharpCorner, radius);
    const other = bubbleRadius(params.otherSharpCorner, radius);

    return {
      mine: {
        backgroundColor: mineBg,
        color: mineText,
        border: `1px solid rgba(20,83,45,0.25)`,
        borderRadius: `${mine['top-left']}px ${mine['top-right']}px ${mine['bottom-right']}px ${mine['bottom-left']}px`,
      },
      other: {
        backgroundColor: otherBg,
        color: otherText,
        border: `1px solid rgba(120,120,120,0.2)`,
        borderRadius: `${other['top-left']}px ${other['top-right']}px ${other['bottom-right']}px ${other['bottom-left']}px`,
      },
      mineImage: { borderRadius: `${imageRadius}px` },
      otherImage: { borderRadius: `${imageRadius}px` },
    };
  },
};