import { FireflyEffect, type FireflyEffectParams } from '@/themes/scene/components/FireflyEffect';
import type { SceneThemeRenderer } from './base';
export const fireflySceneRenderer: SceneThemeRenderer<FireflyEffectParams> = {
  id: 'firefly',
  name: '萤火飞舞',
  description: '萤火虫在深色背景中缓慢漂浮、呼吸闪烁，适合夜间模式。',
  aliases: ['fireflies'],
  defaultParams: {
    count: 50,
    color: '#c8ffc8',
    minSize: 3,
    maxSize: 6,
  },
  schema: [
    { key: 'count', label: '萤火虫数量', type: 'number', min: 10, max: 100, step: 5 },
    { key: 'color', label: '荧光颜色', type: 'color' },
    { key: 'minSize', label: '最小尺寸', type: 'number', min: 1, max: 10, step: 1 },
    { key: 'maxSize', label: '最大尺寸', type: 'number', min: 2, max: 16, step: 1 },
  ],
  component: FireflyEffect,
};