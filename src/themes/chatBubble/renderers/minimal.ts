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
  schema: [],
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