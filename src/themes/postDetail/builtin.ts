import type { ThemePackage } from '@/types';
export const BUILTIN_POST_DETAIL_THEMES: ThemePackage[] = [
  {
    id: 'post-detail-glass',
    name: '玻璃画报',
    version: '1.0.0',
    author: 'XinBlog',
    description: '半透明毛玻璃质感的文章详情页，左侧正文卡片，右侧侧边栏展示作者、推荐文章与目录。',
    previewImage: '',
    minAppVersion: '1.0.0',
    components: {
      postCard: { variant: 'default' },
      postDetail: {
        variant: 'glass',
        showSidebar: true,
        showAuthorCard: true,
        showRecentPosts: true,
        showTOC: true,
        glassOpacity: 0.6,
        contentMaxWidth: 900,
        params: {
          glassOpacity: 0.6,
          contentMaxWidth: 900,
          showSidebar: true,
          showAuthorCard: true,
          showRecentPosts: true,
          showTOC: true,
        },
        schema: [
          { key: 'glassOpacity', label: '玻璃不透明度', type: 'number', min: 0.1, max: 1, step: 0.05 },
          { key: 'contentMaxWidth', label: '内容最大宽度', type: 'number', min: 600, max: 1200, step: 50 },
          { key: 'showAuthorCard', label: '显示作者卡片', type: 'boolean' },
          { key: 'showRecentPosts', label: '显示推荐文章', type: 'boolean' },
          { key: 'showTOC', label: '显示目录', type: 'boolean' },
        ],
      },
    },
  },
];