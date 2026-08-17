import type { ComponentType } from 'react';
import type { ThemeParamSchema } from '@/types';





export interface SceneRenderContext {
  themeColor?: string;
}





export interface SceneThemeRenderer<P extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  name: string;
  description?: string;
  aliases?: string[];
  defaultParams: P;
  schema: ThemeParamSchema[];
  component: ComponentType<{ params: P }>;
}




export function resolveSceneColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const s = value.trim().toLowerCase();
  const emptyValues = ['#000', '#000000', '000000', '000', 'rgb(0,0,0)', 'rgba(0,0,0,0)', 'transparent'];
  if (emptyValues.includes(s)) return fallback;
  return value;
}
