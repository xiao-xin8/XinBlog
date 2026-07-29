import { SnowEffect, type SnowEffectParams } from '@/themes/scene/components/SnowEffect';
import type { SceneThemeRenderer } from './base';
export const snowSceneRenderer: SceneThemeRenderer<SnowEffectParams> = {
  id: 'snow',
  name: '落雪冬夜',
  description: '雪花从屏幕上方缓缓飘落，适合冷色调的冬季主题。',
  aliases: ['snowfall'],
  defaultParams: {
    count: 60,
    color: '#ffffff',
    minSize: 2,
    maxSize: 6,
    minDuration: 5,
    maxDuration: 12,
  },
  schema: [
    { key: 'count', label: '雪花数量', type: 'number', min: 10, max: 120, step: 5 },
    { key: 'color', label: '雪花颜色', type: 'color' },
    { key: 'minSize', label: '最小尺寸', type: 'number', min: 1, max: 10, step: 1 },
    { key: 'maxSize', label: '最大尺寸', type: 'number', min: 2, max: 16, step: 1 },
    { key: 'minDuration', label: '最短飘落时间（秒）', type: 'number', min: 2, max: 20, step: 1 },
    { key: 'maxDuration', label: '最长飘落时间（秒）', type: 'number', min: 4, max: 30, step: 1 },
  ],
  component: SnowEffect,
};