import type { PostCardThemeConfig } from '@/types';
export const defaultCardTheme: PostCardThemeConfig = {
  variant: 'default',
  layout: 'clean',
  showExcerpt: true,
  showTags: true,
  showMeta: true,
};
export function mergeCardTheme(base?: Partial<PostCardThemeConfig>): PostCardThemeConfig {
  if (!base) return { ...defaultCardTheme };
  return { ...defaultCardTheme, ...base };
}
export function normalizeCardTheme(theme: PostCardThemeConfig): PostCardThemeConfig {
  const merged = mergeCardTheme(theme);
  if (theme.params) {
    return { ...merged, ...theme.params };
  }
  return merged;
}