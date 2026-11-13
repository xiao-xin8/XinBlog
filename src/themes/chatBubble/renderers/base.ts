import type { SxProps, Theme } from '@mui/material/styles';
import type { ThemeParamSchema } from '@/types';

/**
 * 聊天气泡主题渲染器上下文。
 * themeColor / borderRadius 用于「留空即用主题色」的兜底。
 */
export interface ChatBubbleRenderContext {
  themeColor?: string;
  borderRadius?: number;
}

/**
 * 聊天气泡渲染产物。
 * mine 应用到「自己」的气泡，other 应用到「对方」的气泡；
 * 尖角用圆角组合表（贴头像一侧保持小圆角，模拟聊天气泡的凸起尖角）。
 */
export interface ChatBubbleRenderOutput {
  mine?: SxProps<Theme>;
  other?: SxProps<Theme>;
  mineImage?: SxProps<Theme>;
  otherImage?: SxProps<Theme>;
}

export interface ChatBubbleRenderer<P extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  name: string;
  description?: string;
  aliases?: string[];
  defaultParams: P;
  schema: ThemeParamSchema[];
  render: (params: P, context: ChatBubbleRenderContext) => ChatBubbleRenderOutput;
}

/**
 * 空值处理：当颜色为空或全黑时，视为使用主题色 / 页面默认。
 */
export function resolveThemeColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const s = value.trim().toLowerCase();
  const empty = ['#000', '#000000', '000000', '000', 'rgb(0,0,0)', 'rgba(0,0,0,0)', 'transparent'];
  if (empty.includes(s)) return fallback;
  return value;
}

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
/** 聊天气泡的四种尖角位置（贴近头像的一角） */
export type BubbleCorners = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** 统一：从主题参数推导图片圆角 */
export function resolveImageRadius(imageRadius: number | undefined, radius: number, cap = 28): number {
  return Math.min(cap, imageRadius || Math.max(4, radius - 2));
}

/**
 * 由「尖角位置」推导气泡圆角组合（四个角：上左/上右/下左/下右）。
 * 聊天气泡惯例：贴近头像的角做小圆角（尖角），其余三个角用统一圆角。
 */
export function bubbleRadius(
  corner: Corner,
  radius: number
): Record<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right', number> {
  return {
    'top-left': radius,
    'top-right': radius,
    'bottom-left': radius,
    'bottom-right': radius,
    [corner]: Math.max(2, Math.min(4, Math.floor(radius * 0.2))),
  } as Record<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right', number>;
}