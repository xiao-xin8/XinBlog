import type { ComponentType } from 'react';
import type { ThemeParamSchema } from '@/types';

/**
 * 场景主题渲染器上下文。
 * 后续可扩展为传入站点配置、当前配色、明暗模式等。
 */
export interface SceneRenderContext {
  themeColor?: string;
}

/**
 * 场景主题渲染器接口。
 * 每个场景主题都是一个带可配置参数的 React 组件。
 */
export interface SceneThemeRenderer<P extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  name: string;
  description?: string;
  aliases?: string[];
  defaultParams: P;
  schema: ThemeParamSchema[];
  component: ComponentType<{ params: P }>;
}

/**
 * 空值处理：当颜色为空或全黑时，视为使用主题色。
 */
export function resolveSceneColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const s = value.trim().toLowerCase();
  const emptyValues = ['#000', '#000000', '000000', '000', 'rgb(0,0,0)', 'rgba(0,0,0,0)', 'transparent'];
  if (emptyValues.includes(s)) return fallback;
  return value;
}
