import type { ThemeColorConfig } from './theme';
import type { SxProps, Theme } from '@mui/material/styles';

export interface ThemeParamOption {
  value: string;
  label: string;
}

export interface ThemeParamSchema {
  key: string;
  label: string;
  type: 'number' | 'boolean' | 'select' | 'color';
  min?: number;
  max?: number;
  step?: number;
  options?: ThemeParamOption[];
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  color?: string;
  count?: number;
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover?: string;
  author: string;
  avatar?: string;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
  readingTime: number;
  views?: number;
}

export interface UserFontFile {
  url: string;
  format: 'woff2' | 'woff' | 'truetype' | 'opentype';
}

export interface UserFont {
  id: string;
  name: string;
  family: string;
  preview: string;
  files: UserFontFile[];
}

export interface SiteFontConfig {
  activeFontId?: string;
  fonts?: UserFont[];
  fallback?: string;
}

export interface UserCursorFile {
  url: string;
  format: 'cur' | 'ani';
  role: string;
  hotspotX?: number;
  hotspotY?: number;
}

export interface UserCursor {
  id: string;
  name: string;
  preview: string;
  files: UserCursorFile[];
}

export interface SiteCursorConfig {
  activeCursorId?: string;
  cursors?: UserCursor[];
  size?: number;
}

export interface PostCardThemeConfig {
  variant: string;
  layout?: 'overlay' | 'clean' | string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  backgroundImage?: string;
  backgroundColor?: string;
  backgroundOpacity?: number;
  textPosition?: 'bottom-left' | 'bottom-center' | 'bottom-right';
  titleSize?: string;
  showExcerpt?: boolean;
  showTags?: boolean;
  showMeta?: boolean;
  styles?: Record<string, SxProps<Theme>>;
  params?: Record<string, unknown>;
  schema?: ThemeParamSchema[];
}

export interface ThemeComponents {
  postCard: PostCardThemeConfig;
}

export interface ThemePackage {
  id: string;
  name: string;
  version?: string;
  author?: string;
  description?: string;
  previewImage?: string;
  minAppVersion?: string;
  components: ThemeComponents;
}

export interface SiteConfig {
  title?: string;
  subtitle?: string;
  author: string;
  avatar?: string;
  logo?: string;
  favicon?: string;
  siteName?: string;
  shareDescription?: string;
  shareImage?: string;
  themeColor: string;
  language: string;
  hero?: HeroConfig;
  about?: AboutConfig;
  friends?: FriendsConfig;
  theme?: SiteThemeConfig;
  font?: SiteFontConfig;
  cursor?: SiteCursorConfig;
  postLayout?: 'grid' | 'list' | 'magazine';
  footerText?: string;
  lazyLoadMedia?: boolean;
  backgroundImage?: string;
  backgroundOpacity?: number;
  backgroundBlur?: number;
  paginationMode?: PaginationMode;
  pageSize?: number;
  cardTheme?: PostCardThemeConfig;
}

export interface FriendLink {
  id: number;
  name: string;
  url: string;
  description?: string;
  avatar?: string;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface FriendsConfig {
  enabled: boolean;
  title: string;
  subtitle: string;
  cardStyle: 'standard' | 'compact';
  cardColor: string;
  avatarShape: 'circle' | 'rounded';
  showDescription: boolean;
}

export interface SiteThemeConfig {
  presetId?: string;
  customColors?: ThemeColorConfig;
  useCustomColors?: boolean;
  borderRadius?: number;
}

export interface HeroConfig {
  enabled?: boolean;
  backgroundImage?: string;
  backgroundColor?: string;
  useCustomUrl?: boolean;
  title?: string;
  subtitle?: string;
  badge?: string;
}

export interface AboutConfig {
  avatar?: string;
  subtitle?: string;
  bio?: string;
  tags?: string[];
}

export interface NavItem {
  title: string;
  path: string;
  icon: string;
}

export type PaginationMode = 'load-more' | 'page-number';
