import type { SiteConfig, SpacingConfig, SpacingValue } from '@/types';

/**
 * 全局间距的默认值。默认值与代码里原始写死的间距保持一致，
 * 因此用户未自定义时外观与“还原默认配置”后完全不变。
 */
export const DEFAULT_SPACING: SpacingConfig = {
  // 主内容区：px { xs:2, md:0 } → 移动 16 / 桌面 0
  mainPaddingX: { mobile: 16, desktop: 0 },
  // 导航栏：px { xs:1, md:0 } + 右侧 pr md:2 → 移动 8 / 桌面 16
  navPaddingX: { mobile: 8, desktop: 16 },
  // 导航栏右侧控件 gap:1 → 8
  navGap: { mobile: 8, desktop: 8 },
  // 页脚 py:4 → 32
  footerPaddingY: { mobile: 32, desktop: 32 },
  // 页脚底部链接 gap { xs:1.5, sm:2.5 } → 移动 12 / 桌面 20
  footerLinkGap: { mobile: 12, desktop: 20 },
  // 文章标题 mt:4 → 32
  articleHeadingGap: { mobile: 32, desktop: 32 },
  // 文章段落 mb:2 → 16
  articleParagraphGap: { mobile: 16, desktop: 16 },
  // 帖子列表卡片间距 spacing:3 / gap:3 → 24
  postListGap: { mobile: 24, desktop: 24 },
  // 主页英雄区 py { xs:6, md:10 } → 移动 48 / 桌面 80
  heroPaddingY: { mobile: 48, desktop: 80 },
  // 主页英雄区 mb { xs:4, md:6 } → 移动 32 / 桌面 48
  heroBottomGap: { mobile: 32, desktop: 48 },
  // 帖子卡片内容 padding { xs:2, sm:3 } → 移动 16 / 桌面 24
  cardPaddingY: { mobile: 16, desktop: 24 },
};

const MIN = 0;
const MAX = 240;

function clampValue(value: number | undefined, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX, Math.max(MIN, n));
}

function resolveValue(raw: SpacingValue | undefined, fallback: SpacingValue): SpacingValue {
  return {
    mobile: clampValue(raw?.mobile, fallback.mobile),
    desktop: clampValue(raw?.desktop, fallback.desktop),
  };
}

/** 从站点配置解析出完整间距配置；缺失的项用默认值兜底（并夹取到合理范围） */
export function resolveSpacingConfig(raw?: SiteConfig['spacing']): SpacingConfig {
  if (!raw) return { ...DEFAULT_SPACING } as SpacingConfig;
  return {
    mainPaddingX: resolveValue(raw.mainPaddingX, DEFAULT_SPACING.mainPaddingX),
    navPaddingX: resolveValue(raw.navPaddingX, DEFAULT_SPACING.navPaddingX),
    navGap: resolveValue(raw.navGap, DEFAULT_SPACING.navGap),
    footerPaddingY: resolveValue(raw.footerPaddingY, DEFAULT_SPACING.footerPaddingY),
    footerLinkGap: resolveValue(raw.footerLinkGap, DEFAULT_SPACING.footerLinkGap),
    articleHeadingGap: resolveValue(raw.articleHeadingGap, DEFAULT_SPACING.articleHeadingGap),
    articleParagraphGap: resolveValue(raw.articleParagraphGap, DEFAULT_SPACING.articleParagraphGap),
    postListGap: resolveValue(raw.postListGap, DEFAULT_SPACING.postListGap),
    heroPaddingY: resolveValue(raw.heroPaddingY, DEFAULT_SPACING.heroPaddingY),
    heroBottomGap: resolveValue(raw.heroBottomGap, DEFAULT_SPACING.heroBottomGap),
    cardPaddingY: resolveValue(raw.cardPaddingY, DEFAULT_SPACING.cardPaddingY),
  };
}

/** 全局间距字段清单，供后台面板渲染与校验使用 */
export const SPACING_FIELDS = Object.keys(DEFAULT_SPACING) as (keyof SpacingConfig)[];