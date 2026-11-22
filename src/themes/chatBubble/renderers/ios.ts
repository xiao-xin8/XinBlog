import type { ChatBubbleRenderer } from './base';
import { resolveThemeColor, bubbleRadius } from './base';

/** iOS 蓝：自己主题色实底 + 白字，对方灰白 + 主题文字色 */
export const iosBubbleRenderer: ChatBubbleRenderer<{
  mineBg: string;
  mineText: string;
  otherBg: string;
  otherText: string;
  radius: number;
  imageRadius: number;
  mineSharpCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  otherSharpCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}> = {
  id: 'ios',
  name: 'iOS 蓝',
  description: '经典 iMessage：自己主题色、对方灰白',
  defaultParams: {
    mineBg: '#38b6ff',
    mineText: '#ffffff',
    otherBg: '#f0f2f5',
    otherText: '#2f3542',
    radius: 18,
    imageRadius: 12,
    mineSharpCorner: 'top-right',
    otherSharpCorner: 'top-left',
  },
  // 深色：比 iOS 标准蓝再压一档（#0a84ff 配白字对比度只有 3.6，读起来发虚）
  darkParams: {
    mineBg: '#0a6ed1',
    mineText: '#ffffff',
    otherBg: '#2c2c2e',
    otherText: '#e8e8ed',
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
    const radius = Math.min(28, params.radius || borderRadius || 18);
    const imageRadius = Math.min(28, params.imageRadius || radius - 2);
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
        border: 'none',
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