import { OceanEffect, type OceanEffectParams } from '@/themes/scene/components/OceanEffect';
import type { SceneThemeRenderer } from './base';

export const oceanSceneRenderer: SceneThemeRenderer<OceanEffectParams> = {
  id: 'ocean',
  name: '海洋呼吸',
  description: '柔和的蓝青色波浪光晕缓慢流动，营造深海般的宁静感。',
  aliases: ['ocean-wave'],
  defaultParams: {
    waveColor: '#06b6d4',
    secondaryColor: '#3b82f6',
    speed: 8,
    opacity: 0.18,
  },
  schema: [
    { key: 'waveColor', label: '波浪主色', type: 'color' },
    { key: 'secondaryColor', label: '光晕副色', type: 'color' },
    { key: 'speed', label: '流动速度', type: 'number', min: 2, max: 20, step: 1 },
    { key: 'opacity', label: '不透明度', type: 'number', min: 0.05, max: 0.6, step: 0.05 },
  ],
  component: OceanEffect,
};
