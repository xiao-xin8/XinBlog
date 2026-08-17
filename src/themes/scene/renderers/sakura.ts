import { SakuraEffect, type SakuraEffectParams } from '@/themes/scene/components/SakuraEffect';
import type { SceneThemeRenderer } from './base';

export const sakuraSceneRenderer: SceneThemeRenderer<SakuraEffectParams> = {
  id: 'sakura',
  name: '樱花飘落',
  description: '粉色花瓣缓缓飘落，营造春日清晨的浪漫氛围。',
  aliases: ['sakura-morning'],
  defaultParams: {
    count: 40,
    color: '#f9a8d4',
    minSize: 8,
    maxSize: 20,
    minDuration: 6,
    maxDuration: 14,
  },
  schema: [
    { key: 'count', label: '花瓣数量', type: 'number', min: 10, max: 100, step: 5 },
    { key: 'color', label: '花瓣颜色', type: 'color' },
    { key: 'minSize', label: '最小尺寸', type: 'number', min: 2, max: 20, step: 1 },
    { key: 'maxSize', label: '最大尺寸', type: 'number', min: 4, max: 40, step: 1 },
    { key: 'minDuration', label: '最短飘落时间（秒）', type: 'number', min: 2, max: 20, step: 1 },
    { key: 'maxDuration', label: '最长飘落时间（秒）', type: 'number', min: 4, max: 30, step: 1 },
  ],
  component: SakuraEffect,
};
