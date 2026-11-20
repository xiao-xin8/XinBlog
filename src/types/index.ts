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

/** 聊天气泡主题配置：variant 指定内置主题，params 承载可选参数（schema 驱动后台表单） */
export interface ChatBubbleThemeConfig {
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
  chatBubble?: ChatBubbleThemeConfig;
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
  /** 音乐 API 地址，用于拉取网易云歌单/音频/歌词 */
  apiUrl: string;
  /** 网易云歌单 ID */
  playlistId: string;
  /** 默认音量 0-1 */
  volume: number;
  /** 播放模式：列表循环 / 单曲循环 / 随机 */
  playMode: MusicPlayMode;
  /** 是否自动播放（未开启时也会加载并显示歌曲，等待用户手动播放） */
  autoplay: boolean;
  /** 是否显示歌词 */
  showLyric: boolean;
  /** 是否记忆播放（记住上次歌曲、进度、音量与模式） */
  memory: boolean;
  /** 侧边悬浮小工具位置：左侧或右侧 */
  position: 'left' | 'right';
  /** 进入管理后台后继续播放 */
  showInAdmin: boolean;
  /** 启用独立音乐播放页面（在首页同级添加 /music 路由） */
  showPage: boolean;
  /** 是否通过 Cloudflare Worker 中转代理图片（解决 PWA 显示外部 CDN URL 的问题） */
  imageProxy: boolean;
}

/** 通用间距值：分别控制移动端(窄屏)与桌面端(宽屏)，单位 px */
export interface SpacingValue {
  mobile: number;
  desktop: number;
}

/** 全局间距配置。对应“外观设置 → 间距”面板，所有值为 px */
export interface SpacingConfig {
  /** 主内容区：左右内边距（所有页面的内容与屏幕左右边缘的距离） */
  mainPaddingX: SpacingValue;
  /** 导航栏：左右内边距 */
  navPaddingX: SpacingValue;
  /** 导航栏：右侧控件（搜索/主题/头像）之间的间距 */
  navGap: SpacingValue;
  /** 页脚：上下内边距 */
  footerPaddingY: SpacingValue;
  /** 页脚：底部链接（用户协议/隐私政策）间距 */
  footerLinkGap: SpacingValue;
  /** 文章正文：标题（h1~h6）上方的间距 */
  articleHeadingGap: SpacingValue;
  /** 文章正文：段落之间的间距 */
  articleParagraphGap: SpacingValue;
  /** 帖子列表：卡片之间的间距（网格/横向/杂志布局通用） */
  postListGap: SpacingValue;
  /** 主页英雄区：上下内边距 */
  heroPaddingY: SpacingValue;
  /** 主页英雄区：与下方内容的间距 */
  heroBottomGap: SpacingValue;
  /** 帖子卡片：内容区内边距 */
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
  icpBeian?: string;
  policeBeian?: string;
  /** AI 智能体（AI 助手）功能是否开启：站点 AI 功能开启且启用了 Agent 时为 true */
  agentEnabled?: boolean;
  /** 文章正文图片显示模式 */
  imageDisplayMode?: 'fixed' | 'natural';
  /** 后台概览页是否显示统计折线面板（默认开启） */
  enableDashboardStats?: boolean;
  backgroundImage?: string;
  backgroundOpacity?: number;
  backgroundBlur?: number;
  paginationMode?: PaginationMode;
  pageSize?: number;
  cardTheme?: PostCardThemeConfig;
  sceneTheme?: SceneThemeConfig;
  postDetailTheme?: PostDetailThemeConfig;
  chatBubbleTheme?: ChatBubbleThemeConfig;
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
  /** 是否开放友链申请 */
  applyEnabled?: boolean;
  /** 是否需审核后展示；false=申请即展示 */
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
  /** 导航布局：sidebar=侧边栏（默认）/ top=顶部胶囊 Tab 栏 */
  layout?: 'sidebar' | 'top';
  items: NavItemConfig[];
  theme?: NavThemeConfig;
}

export interface SiteThemeConfig {
  presetId?: string;
  customColors?: ThemeColorConfig;
  useCustomColors?: boolean;
  borderRadius?: number;
}

export interface HeroConfig {
  enabled?: boolean;
  /** classic=默认渐变；fullscreen=全屏大图（已下线的 bento 会自动归一到 fullscreen） */
  mode?: 'classic' | 'fullscreen';
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
