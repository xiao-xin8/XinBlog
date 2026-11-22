import type { ChatBubbleRenderer } from './base';
import { resolveThemeColor, bubbleRadius, resolveImageRadius, withAlpha, type BubbleCorners } from './base';

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
  // 深色：大理石底由 render 按 mode 换成深色渐层，这里只调文字
  darkParams: {
    mineText: '#dfe3ea',
    otherText: '#c3c9d4',
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
  render: (params, { themeColor, borderRadius, mode }) => {
    const isDark = mode === 'dark';
    const radius = Math.min(28, params.radius || borderRadius || 14);
    const imageRadius = resolveImageRadius(params.imageRadius, radius);
    const mine = bubbleRadius(params.mineSharpCorner, radius);
    const other = bubbleRadius(params.otherSharpCorner, radius);
    const base = themeColor || '#5b7cfa';
    const mineText = resolveThemeColor(params.mineText, '#374151');
    const otherText = resolveThemeColor(params.otherText, '#6b7280');

    // 原来用 `${tint}22` 字符串拼接透明度，themeColor 是 rgb()/短 hex 时会变成非法颜色
    const veins = (tint: string) => `
      radial-gradient(ellipse at 20% 15%, ${withAlpha(tint, isDark ? 0.13 : 0.08)} 0%, transparent 60%),
      radial-gradient(ellipse at 80% 70%, ${withAlpha(tint, isDark ? 0.09 : 0.06)} 0%, transparent 55%),
      linear-gradient(135deg, ${isDark ? '#2b2f36' : '#ffffff'} 0%, ${isDark ? '#1f2228' : '#f2f4f7'} 100%)`;

    // 深色下浅色描边会消失，换成极淡的亮边
    const edge = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)';

    return {
      mine: {
        background: veins(base),
        color: mineText,
        border: edge,
        borderRadius: `${mine['top-left']}px ${mine['top-right']}px ${mine['bottom-right']}px ${mine['bottom-left']}px`,
      },
      other: {
        background: veins('#9aa0a6'),
        color: otherText,
        border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.05)',
        borderRadius: `${other['top-left']}px ${other['top-right']}px ${other['bottom-right']}px ${other['bottom-left']}px`,
      },
      mineImage: { borderRadius: `${imageRadius}px` },
      otherImage: { borderRadius: `${imageRadius}px` },
    };
  },
};