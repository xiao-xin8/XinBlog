import type { SxProps, Theme } from '@mui/material/styles';
import type { ThemeParamSchema } from '@/types';

/**
 * 聊天气泡主题渲染器上下文。
 * themeColor / borderRadius 用于「留空即用主题色」的兜底。
 */
export interface ChatBubbleRenderContext {
  themeColor?: string;
  borderRadius?: number;
  /** 当前界面深浅模式。渲染器可据此返回暗色版配色 */
  mode?: 'light' | 'dark';
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
  /**
   * 深色模式下的配色覆盖，只写颜色键即可（圆角、尖角等结构参数沿用浅色版）。
   * 不提供表示「该主题没做深色适配」——深色下会自动回退到默认气泡，
   * 避免出现浅色气泡配亮色文字、内容看不清。
   */
  darkParams?: Partial<P>;
  schema: ThemeParamSchema[];
  render: (params: P, context: ChatBubbleRenderContext) => ChatBubbleRenderOutput;
}

/**
 * 按当前模式合并气泡主题参数。
 * 优先级：默认参数 ← 深色覆盖 ← 用户自定义（用户在后台显式调过的颜色最终生效）。
 * 返回 null 表示该主题未适配深色，调用方应回退到默认气泡配色。
 */
export function resolveBubbleParams<P extends Record<string, unknown>>(
  renderer: ChatBubbleRenderer<P>,
  userParams: Partial<P> | undefined,
  mode: 'light' | 'dark' | undefined,
): P | null {
  if (mode === 'dark' && !renderer.darkParams) return null;
  return {
    ...renderer.defaultParams,
    ...(mode === 'dark' ? renderer.darkParams : {}),
    ...(userParams || {}),
  } as P;
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

/**
 * 给颜色加透明度。不能像 `#rrggbb` + `22` 那样直接字符串拼接——
 * 主题色可能是 `rgb()/rgba()` 或三位短 hex，拼出来就是非法颜色，整块背景会失效。
 */
export function withAlpha(color: string, alpha: number): string {
  const s = (color || '').trim();
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    if (/^[0-9a-fA-F]{6}$/.test(full)) {
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
  }
  // 已经是 rgba() 的非 hex 颜色：原样返回（不强行改写，避免猜错格式）
  return s;
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