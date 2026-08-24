import type { SiteConfig, SpacingConfig, SpacingValue } from '@/types';


export const DEFAULT_SPACING: SpacingConfig = {
  
  mainPaddingX: { mobile: 16, desktop: 0 },
  
  navPaddingX: { mobile: 8, desktop: 16 },
  
  navGap: { mobile: 8, desktop: 8 },
  
  footerPaddingY: { mobile: 32, desktop: 32 },
  
  footerLinkGap: { mobile: 12, desktop: 20 },
  
  articleHeadingGap: { mobile: 32, desktop: 32 },
  
  articleParagraphGap: { mobile: 16, desktop: 16 },
  
  postListGap: { mobile: 24, desktop: 24 },
  
  heroPaddingY: { mobile: 48, desktop: 80 },
  
  heroBottomGap: { mobile: 32, desktop: 48 },
  
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


export const SPACING_FIELDS = Object.keys(DEFAULT_SPACING) as (keyof SpacingConfig)[];