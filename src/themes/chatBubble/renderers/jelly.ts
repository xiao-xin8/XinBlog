import type { ChatBubbleRenderer } from './base';
import { resolveThemeColor, bubbleRadius, resolveImageRadius, type BubbleCorners } from './base';

interface JellyParams extends Record<string, unknown> {
  mineA: string;
  mineB: string;
  mineText: string;
  otherA: string;
  otherB: string;
  otherText: string;
  radius: number;
  imageRadius: number;
  mineSharpCorner: BubbleCorners;
  otherSharpCorner: BubbleCorners;
}

/** 果冻渐变：顶部高光到底部深色的甜点渐变，QQ 弹弹性 */
export const jellyBubbleRenderer: ChatBubbleRenderer<JellyParams> = {
  id: 'jelly',
  name: '果冻',
  description: '果冻渐变：上浅下深的 Q 弹色泽',
  defaultParams: {
    mineA: '#ff9a9e',
    mineB: '#fad0c4',
    mineText: '#7a2440',
    otherA: '#fdfcfb',
    otherB: '#e6e9f0',
    otherText: '#444',
    radius: 22,
    imageRadius: 12,
    mineSharpCorner: 'top-right',
    otherSharpCorner: 'top-left',
  },
  schema: [
    { key: 'mineA', label: '自己渐变高光色', type: 'color' },
    { key: 'mineB', label: '自己渐变深色', type: 'color' },
    { key: 'mineText', label: '自己文字颜色', type: 'color' },
    { key: 'otherA', label: '对方渐变高光色', type: 'color' },
    { key: 'otherB', label: '对方渐变深色', type: 'color' },
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
    const radius = Math.min(28, params.radius || borderRadius || 22);
    const imageRadius = resolveImageRadius(params.imageRadius, radius);
    const mineA = resolveThemeColor(params.mineA, '#ff9a9e');
    const mineB = resolveThemeColor(params.mineB, '#fad0c4');
    const otherA = resolveThemeColor(params.otherA, '#fdfcfb');
    const otherB = resolveThemeColor(params.otherB, '#e6e9f0');
    const mine = bubbleRadius(params.mineSharpCorner, radius);
    const other = bubbleRadius(params.otherSharpCorner, radius);

    return {
      mine: {
        background: `radial-gradient(ellipse at 20% 0%, ${mineA} 0%, ${mineB} 45%, ${mineB} 100%)`,
        color: params.mineText || '#7a2440',
        boxShadow: `inset 0 2px 4px rgba(255,255,255,0.5), inset 0 -2px 6px rgba(122,36,64,0.15)`,
        borderRadius: `${mine['top-left']}px ${mine['top-right']}px ${mine['bottom-right']}px ${mine['bottom-left']}px`,
        border: 'none',
      },
      other: {
        background: `radial-gradient(ellipse at 20% 0%, ${otherA} 0%, ${otherB} 60%, ${otherB} 100%)`,
        color: params.otherText || '#444',
        boxShadow: `inset 0 1px 2px rgba(255,255,255,0.6)`,
        borderRadius: `${other['top-left']}px ${other['top-right']}px ${other['bottom-right']}px ${other['bottom-left']}px`,
        border: 'none',
      },
      mineImage: { borderRadius: `${imageRadius}px` },
      otherImage: { borderRadius: `${imageRadius}px` },
    };
  },
};