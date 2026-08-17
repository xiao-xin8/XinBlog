import type { ThemePackage } from '@/types';





export const BUILTIN_SCENE_THEMES: ThemePackage[] = [
  {
    id: 'sakura-morning',
    name: '樱花清晨',
    version: '1.0.0',
    author: 'XinBlog',
    description: '粉色花瓣缓缓飘落，营造春日清晨的浪漫氛围。',
    previewImage: '',
    minAppVersion: '1.0.0',
    components: {
      postCard: { variant: 'default' },
      scene: {
        variant: 'sakura',
        params: {
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
      },
    },
  },
  {
    id: 'firefly-night',
    name: '萤火深空',
    version: '1.0.0',
    author: 'XinBlog',
    description: '萤火虫在深色背景中缓慢漂浮、呼吸闪烁，适合夜间模式。',
    previewImage: '',
    minAppVersion: '1.0.0',
    components: {
      postCard: { variant: 'default' },
      scene: {
        variant: 'firefly',
        params: {
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
      },
    },
  },
  {
    id: 'ocean-wave',
    name: '海洋呼吸',
    version: '1.0.0',
    author: 'XinBlog',
    description: '柔和的蓝青色波浪光晕缓慢流动，营造深海般的宁静感。',
    previewImage: '',
    minAppVersion: '1.0.0',
    components: {
      postCard: { variant: 'default' },
      scene: {
        variant: 'ocean',
        params: {
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
      },
    },
  },
  {
    id: 'snow-winter',
    name: '落雪冬夜',
    version: '1.0.0',
    author: 'XinBlog',
    description: '雪花从屏幕上方缓缓飘落，适合冷色调的冬季主题。',
    previewImage: '',
    minAppVersion: '1.0.0',
    components: {
      postCard: { variant: 'default' },
      scene: {
        variant: 'snow',
        params: {
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
      },
    },
  },
];
