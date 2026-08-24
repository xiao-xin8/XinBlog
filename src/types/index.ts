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

export type ClickEffectType = 'heart' | 'bubble' | 'ripple' | 'text' | 'firework' | 'star' | 'confetti';
export type ClickEffectColorMode = 'theme' | 'random' | 'custom';
export type ClickEffectIntensity = 'low' | 'medium' | 'high';

export interface ClickEffectConfig {
  enabled: boolean;
  type: ClickEffectType;
  colorMode: ClickEffectColorMode;
  customColor?: string;
  textList?: string[];
  intensity?: ClickEffectIntensity;
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

export interface SceneThemeConfig {
  variant: string;
  params?: Record<string, unknown>;
  schema?: ThemeParamSchema[];
}

export interface PostDetailThemeConfig {
  variant: string;
  params?: Record<string, unknown>;
  schema?: ThemeParamSchema[];
  showSidebar?: boolean;
  showAuthorCard?: boolean;
  showRecentPosts?: boolean;
  showTOC?: boolean;
  glassOpacity?: number;
  contentMaxWidth?: number;
}

export interface ThemeComponents {
  postCard: PostCardThemeConfig;
  scene?: SceneThemeConfig;
  postDetail?: PostDetailThemeConfig;
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

export interface Live2dConfig {
  enabled: boolean;
  mobileEnabled: boolean;
  position: 'left' | 'right';
  width: number;
  height: number;
  mobileWidth?: number;
  mobileHeight?: number;
  tools: string[];
  drag: boolean;
  showToggleAfterQuit: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'trace';
  modelSource: 'local' | 'cdn';
  customCdn?: string;
  waifuPath: string;
  cdnPath: string;
  cubism2Path: string;
  cubism5Path: string;
}

export type MusicPlayMode = 'list' | 'single' | 'random';

export interface MusicPlayerConfig {
  enabled: boolean;
  
  apiUrl: string;
  
  playlistId: string;
  
  volume: number;
  
  playMode: MusicPlayMode;
  
  autoplay: boolean;
  
  showLyric: boolean;
  
  memory: boolean;
  
  position: 'left' | 'right';
  
  showInAdmin: boolean;
  
  showPage: boolean;
  
  imageProxy: boolean;
}


export interface SpacingValue {
  mobile: number;
  desktop: number;
}


export interface SpacingConfig {
  
  mainPaddingX: SpacingValue;
  
  navPaddingX: SpacingValue;
  
  navGap: SpacingValue;
  
  footerPaddingY: SpacingValue;
  
  footerLinkGap: SpacingValue;
  
  articleHeadingGap: SpacingValue;
  
  articleParagraphGap: SpacingValue;
  
  postListGap: SpacingValue;
  
  heroPaddingY: SpacingValue;
  
  heroBottomGap: SpacingValue;
  
  cardPaddingY: SpacingValue;
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
  pwaThemeColor?: string;
  language: string;
  hero?: HeroConfig;
  about?: AboutConfig;
  friends?: FriendsConfig;
  theme?: SiteThemeConfig;
  font?: SiteFontConfig;
  cursor?: SiteCursorConfig;
  clickEffect?: ClickEffectConfig;
  live2d?: Live2dConfig;
  music?: MusicPlayerConfig;
  postLayout?: 'grid' | 'list' | 'magazine';
  footerText?: string;
  lazyLoadMedia?: boolean;
  enableLatex?: boolean;
  disableSmoothScroll?: boolean;
  
  imageDisplayMode?: 'fixed' | 'natural';
  
  enableDashboardStats?: boolean;
  backgroundImage?: string;
  backgroundOpacity?: number;
  backgroundBlur?: number;
  paginationMode?: PaginationMode;
  pageSize?: number;
  cardTheme?: PostCardThemeConfig;
  sceneTheme?: SceneThemeConfig;
  postDetailTheme?: PostDetailThemeConfig;
  nav?: NavConfig;
  termsAgreement?: string;
  termsPrivacy?: string;
  spacing?: SpacingConfig;
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
  
  applyEnabled?: boolean;
  
  applyNeedsAudit?: boolean;
}

export interface FriendApplication {
  id: number;
  name: string;
  url: string;
  description?: string;
  email?: string;
  avatar?: string;
  status: 'pending' | 'approved' | 'rejected';
  remark?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface NavItemConfig {
  id: string;
  title: string;
  url: string;
  color?: string;
  openInNewTab?: boolean;
}

export interface NavThemeConfig {
  variant: 'default' | 'glass';
  glassOpacity?: number;
  blur?: number;
  borderOpacity?: number;
  shadowOpacity?: number;
  textColor?: string;
  activeColor?: string;
  logoText?: string;
  hideOnScroll?: boolean;
}

export interface NavConfig {
  items: NavItemConfig[];
  theme?: NavThemeConfig;
}

export interface SiteThemeConfig {
  presetId?: string;
  customColors?: ThemeColorConfig;
  useCustomColors?: boolean;
  borderRadius?: number;
}

export interface HeroWidgetConfig {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  props?: Record<string, unknown>;
  hideOnMobile?: boolean;
}

export interface HeroLayout {
  cols: number;
  gap: number;
  widgets: HeroWidgetConfig[];
}

export interface HeroConfig {
  enabled?: boolean;
  mode?: 'classic' | 'bento';
  backgroundImage?: string;
  backgroundColor?: string;
  useCustomUrl?: boolean;
  title?: string;
  subtitle?: string;
  badge?: string;
  layout?: HeroLayout;
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
