import type { ChatBubbleRenderer } from './base';
import { resolveThemeColor, bubbleRadius, resolveImageRadius, withAlpha, type BubbleCorners } from './base';

interface NeonParams extends Record<string, unknown> {
  mineBg: string;
  mineText: string;
  mineGlow: string;
  otherBg: string;
  otherText: string;
  otherGlow: string;
  radius: number;
  imageRadius: number;
  mineSharpCorner: BubbleCorners;
  otherSharpCorner: BubbleCorners;
}

/** 霓虹风：深色底 + 四周彩色外发光，赛博霓虹夜感 */
export const neonBubbleRenderer: ChatBubbleRenderer<NeonParams> = {
  id: 'neon',
  name: '霓虹',
  description: '赛博霓虹：深底 + 彩色外发光晕',
  defaultParams: {
    mineBg: '#1a1b26',
    mineText: '#7cffcb',
    mineGlow: '#7cffcb',
    otherBg: '#1a1b26',
    otherText: '#e0e0e0',
    otherGlow: 'rgba(124,255,203,0.35)',
    radius: 18,
    imageRadius: 12,
    mineSharpCorner: 'top-right',
    otherSharpCorner: 'top-left',
  },
  // 霓虹本身就是暗底，深色下把底再压一点，保证在深色页面里有层次
  darkParams: {
    mineBg: '#0f1018',
    mineText: '#7cffcb',
    mineGlow: '#7cffcb',
    otherBg: '#0f1018',
    otherText: '#e0e0e0',
    otherGlow: 'rgba(124,255,203,0.35)',
  },
  schema: [
    { key: 'mineBg', label: '自己气泡背景色', type: 'color' },
    { key: 'mineText', label: '自己发光文字色', type: 'color' },
    { key: 'mineGlow', label: '自己外发光色', type: 'color' },
    { key: 'otherBg', label: '对方气泡背景色', type: 'color' },
    { key: 'otherText', label: '对方文字颜色', type: 'color' },
    { key: 'otherGlow', label: '对方外发光色', type: 'color' },
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
    const radius = Math.min(28, params.radius || borderRadius || 18);
    const imageRadius = resolveImageRadius(params.imageRadius, radius);
    const mineBg = resolveThemeColor(params.mineBg, '#1a1b26');
    const mineGlow = resolveThemeColor(params.mineGlow, '#7cffcb');
    const mineText = resolveThemeColor(params.mineText, '#7cffcb');
    const otherBg = resolveThemeColor(params.otherBg, '#1a1b26');
    const otherText = resolveThemeColor(params.otherText, '#e0e0e0');
    const otherGlow = resolveThemeColor(params.otherGlow, 'rgba(124,255,203,0.35)');
    const mine = bubbleRadius(params.mineSharpCorner, radius);
    const other = bubbleRadius(params.otherSharpCorner, radius);
    // 发光色跟随参数（原来内阴影写死绿色，换发光色后内圈还是绿的）；文字发光收一点，长文不发虚
    const textShadow = (glow: string) => `0 0 6px ${glow}`;

    return {
      mine: {
        backgroundColor: mineBg,
        color: mineText,
        border: `1px solid ${mineGlow}`,
        boxShadow: `0 0 10px ${mineGlow}, inset 0 0 8px ${withAlpha(mineGlow, 0.18)}`,
        textShadow: textShadow(mineGlow),
        borderRadius: `${mine['top-left']}px ${mine['top-right']}px ${mine['bottom-right']}px ${mine['bottom-left']}px`,
      },
      other: {
        backgroundColor: otherBg,
        color: otherText,
        border: `1px solid ${otherGlow}`,
        boxShadow: `0 0 10px ${otherGlow}`,
        borderRadius: `${other['top-left']}px ${other['top-right']}px ${other['bottom-right']}px ${other['bottom-left']}px`,
      },
      mineImage: { borderRadius: `${imageRadius}px` },
      otherImage: { borderRadius: `${imageRadius}px` },
    };
  },
};