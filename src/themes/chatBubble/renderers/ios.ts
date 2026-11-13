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
  schema: [],
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