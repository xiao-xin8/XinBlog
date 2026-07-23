

import type { ThemePackage } from '@/types';

export const BUILTIN_THEMES: ThemePackage[] = [
  {
    id: 'border-image-card',
    name: '边框画报',
    version: '1.0.0',
    author: 'XinBlog',
    description: '以站点主色勾勒边框，使用文章封面作为背景，文字置于左下角的画报风格卡片。',
    previewImage: '',
    minAppVersion: '1.0.0',
    components: {
      postCard: {
        variant: 'border-image',
        layout: 'overlay',
        showExcerpt: true,
        showTags: true,
        showMeta: true,
        params: {
          borderWidth: 4,
          borderRadius: 24,
          borderColor: '#5b7cfa',
          backgroundColor: '#f0f4ff',
          textPosition: 'bottom-left',
          titleSize: 'large',
        },
        schema: [
          { key: 'borderWidth', label: '边框宽度', type: 'number', min: 0, max: 12, step: 1 },
          { key: 'borderRadius', label: '卡片圆角', type: 'number', min: 0, max: 32, step: 2 },
          { key: 'borderColor', label: '边框颜色', type: 'color' },
          { key: 'backgroundColor', label: '背景颜色', type: 'color' },
          {
            key: 'titleSize',
            label: '标题大小',
            type: 'select',
            options: [
              { value: 'small', label: '小' },
              { value: 'medium', label: '中' },
              { value: 'large', label: '大' },
            ],
          },
          { key: 'showExcerpt', label: '显示摘要', type: 'boolean' },
          { key: 'showTags', label: '显示标签', type: 'boolean' },
          { key: 'showMeta', label: '显示阅读时间等元信息', type: 'boolean' },
        ],
      },
    },
  },
];
