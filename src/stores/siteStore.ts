import { create } from 'zustand';
import { apiGet, apiPatch } from '@/api/client';
import { themePresets } from '@/types/theme';
import { defaultCardTheme } from '@/utils/postCardTheme';
import type { SiteConfig, SiteFontConfig, SiteCursorConfig, Live2dConfig, ClickEffectConfig, MusicPlayerConfig } from '@/types';

const defaultPreset = themePresets.find((p) => p.id === 'ocean') || themePresets[0];

const DEFAULT_FONT_CONFIG: Required<Pick<SiteFontConfig, 'activeFontId' | 'fonts' | 'fallback'>> = {
  activeFontId: '',
  fonts: [],
  fallback: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

const DEFAULT_CURSOR_CONFIG: Required<Pick<SiteCursorConfig, 'activeCursorId' | 'cursors' | 'size'>> = {
  activeCursorId: '',
  cursors: [],
  size: 32,
};

const DEFAULT_CLICK_EFFECT_CONFIG: Required<ClickEffectConfig> = {
  enabled: false,
  type: 'heart',
  colorMode: 'theme',
  customColor: '',
  textList: ['❤富强❤', '❤民主❤', '❤文明❤', '❤和谐❤', '❤自由❤', '❤平等❤', '❤公正❤', '❤法治❤'],
  intensity: 'medium',
};

const DEFAULT_LIVE2D_CONFIG: Live2dConfig = {
  enabled: false,
  mobileEnabled: true,
  position: 'right',
  width: 280,
  height: 280,
  tools: ['hitokoto', 'asteroids', 'switch-model', 'switch-texture', 'photo', 'info', 'quit'],
  drag: false,
  showToggleAfterQuit: true,
  logLevel: 'warn',
  modelSource: 'cdn',
  customCdn: '',
  waifuPath: '/live2d/waifu-tips.json',
  cdnPath: '/live2d-models/',
  cubism2Path: '/live2d/live2d.min.js',
  cubism5Path: 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
};

const DEFAULT_MUSIC_CONFIG: MusicPlayerConfig = {
  enabled: false,
  apiUrl: 'https://api.xfyun.club',
  playlistId: '',
  volume: 0.8,
  playMode: 'list',
  autoplay: true,
  showLyric: true,
  memory: true,
  position: 'right',
  showInAdmin: false,
  showPage: false,
  imageProxy: false,
};

const defaultConfig: SiteConfig = {
  author: 'Xin',
  siteName: 'XinBlog',
  shareDescription: 'XinBlog - 一个记录生活、设计与技术感悟的个人博客',
  shareImage: '',
  themeColor: '#5b7cfa',
  pwaThemeColor: '#ffffff',
  language: 'zh-CN',
  postLayout: 'grid',
  footerText: '',
  lazyLoadMedia: false,
  enableLatex: false,
  disableSmoothScroll: false,
  enableDashboardStats: true,
  paginationMode: 'load-more',
  pageSize: 9,
  theme: {
    presetId: defaultPreset.id,
    customColors: { ...defaultPreset.colors },
    useCustomColors: false,
    borderRadius: 16,
  },
  cardTheme: { ...defaultCardTheme },
  sceneTheme: { variant: 'default' },
  postDetailTheme: { variant: 'default' },
  hero: {
    enabled: true,
    mode: 'classic',
    title: '',
    subtitle: '',
    badge: '',
    layout: {
      cols: 6,
      gap: 16,
      widgets: [],
    },
  },
  about: {
    subtitle: '',
    bio: '',
    tags: [],
  },
  friends: {
    enabled: false,
    title: '友链',
    subtitle: '在时光中相遇，结识志同道合的朋友',
    cardStyle: 'standard',
    cardColor: '',
    avatarShape: 'rounded',
    showDescription: true,
  },
  font: { ...DEFAULT_FONT_CONFIG },
  cursor: { ...DEFAULT_CURSOR_CONFIG },
  clickEffect: { ...DEFAULT_CLICK_EFFECT_CONFIG },
  live2d: { ...DEFAULT_LIVE2D_CONFIG },
  music: { ...DEFAULT_MUSIC_CONFIG },
  nav: {
    items: [],
    theme: {
      variant: 'default',
      glassOpacity: 0.4,
      blur: 16,
      borderOpacity: 0.2,
      shadowOpacity: 0.08,
      textColor: '',
      activeColor: '',
      logoText: '',
      hideOnScroll: true,
    },
  },
  termsAgreement: '',
  termsPrivacy: '',
};

const SITE_CACHE_KEY = 'site-config-cache';
const SITE_CACHE_TTL = 3 * 60 * 60 * 1000; 

function normalizeFontConfig(font: SiteConfig['font']): typeof DEFAULT_FONT_CONFIG {
  if (!font) return { ...DEFAULT_FONT_CONFIG };
  
  if ('source' in font) {
    return {
      ...DEFAULT_FONT_CONFIG,
      fallback: (font as { fallback?: string }).fallback || DEFAULT_FONT_CONFIG.fallback,
    };
  }
  return {
    ...DEFAULT_FONT_CONFIG,
    ...font,
    fonts: font.fonts || [],
  };
}

function normalizeCursorConfig(cursor: SiteConfig['cursor']): typeof DEFAULT_CURSOR_CONFIG {
  if (!cursor) return { ...DEFAULT_CURSOR_CONFIG };
  return {
    ...DEFAULT_CURSOR_CONFIG,
    ...cursor,
    cursors: cursor.cursors || [],
    size: typeof cursor.size === 'number' && cursor.size > 0 ? cursor.size : DEFAULT_CURSOR_CONFIG.size,
  };
}

function normalizeClickEffectConfig(clickEffect: SiteConfig['clickEffect']): typeof DEFAULT_CLICK_EFFECT_CONFIG {
  if (!clickEffect || typeof clickEffect !== 'object') return { ...DEFAULT_CLICK_EFFECT_CONFIG };
  return {
    ...DEFAULT_CLICK_EFFECT_CONFIG,
    ...clickEffect,
    enabled: !!clickEffect.enabled,
    type: clickEffect.type || DEFAULT_CLICK_EFFECT_CONFIG.type,
    colorMode: clickEffect.colorMode || DEFAULT_CLICK_EFFECT_CONFIG.colorMode,
    textList: Array.isArray(clickEffect.textList) && clickEffect.textList.length > 0
      ? clickEffect.textList
      : DEFAULT_CLICK_EFFECT_CONFIG.textList,
    intensity: clickEffect.intensity || DEFAULT_CLICK_EFFECT_CONFIG.intensity,
  };
}

function normalizeLive2dConfig(live2d: SiteConfig['live2d']): Live2dConfig {
  if (!live2d) return { ...DEFAULT_LIVE2D_CONFIG };
  return {
    ...DEFAULT_LIVE2D_CONFIG,
    ...live2d,
    
    waifuPath: DEFAULT_LIVE2D_CONFIG.waifuPath,
    cdnPath: DEFAULT_LIVE2D_CONFIG.cdnPath,
    cubism2Path: DEFAULT_LIVE2D_CONFIG.cubism2Path,
    cubism5Path: DEFAULT_LIVE2D_CONFIG.cubism5Path,
    modelSource: live2d.modelSource || DEFAULT_LIVE2D_CONFIG.modelSource,
    mobileEnabled: typeof live2d.mobileEnabled === 'boolean' ? live2d.mobileEnabled : DEFAULT_LIVE2D_CONFIG.mobileEnabled,
    tools: Array.isArray(live2d.tools) && live2d.tools.length > 0 ? live2d.tools : DEFAULT_LIVE2D_CONFIG.tools,
  };
}

function normalizeMusicConfig(music: SiteConfig['music']): MusicPlayerConfig {
  if (!music || typeof music !== 'object') return { ...DEFAULT_MUSIC_CONFIG };
  return {
    ...DEFAULT_MUSIC_CONFIG,
    ...music,
    enabled: !!music.enabled,
    apiUrl: typeof music.apiUrl === 'string' && music.apiUrl.trim() ? music.apiUrl.trim() : DEFAULT_MUSIC_CONFIG.apiUrl,
    playlistId: typeof music.playlistId === 'string' ? music.playlistId.trim() : '',
    volume: typeof music.volume === 'number' && music.volume >= 0 && music.volume <= 1 ? music.volume : DEFAULT_MUSIC_CONFIG.volume,
    playMode: music.playMode === 'list' || music.playMode === 'single' || music.playMode === 'random'
      ? music.playMode
      : DEFAULT_MUSIC_CONFIG.playMode,
    autoplay: typeof music.autoplay === 'boolean' ? music.autoplay : DEFAULT_MUSIC_CONFIG.autoplay,
    showLyric: !!music.showLyric,
    memory: !!music.memory,
    position: music.position === 'left' || music.position === 'right' ? music.position : DEFAULT_MUSIC_CONFIG.position,
    showInAdmin: !!music.showInAdmin,
    showPage: !!music.showPage,
    imageProxy: !!music.imageProxy,
  };
}

export function normalizeSiteConfig(config: SiteConfig): SiteConfig {
  return {
    ...config,
    font: normalizeFontConfig(config.font),
    cursor: normalizeCursorConfig(config.cursor),
    clickEffect: normalizeClickEffectConfig(config.clickEffect),
    live2d: normalizeLive2dConfig(config.live2d),
    music: normalizeMusicConfig(config.music),
  };
}

function getCachedSiteConfig(): SiteConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SITE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.config && typeof parsed.ts === 'number') {
      if (Date.now() - parsed.ts < SITE_CACHE_TTL) {
        return parsed.config as SiteConfig;
      }
    }
  } catch {
    
  }
  return null;
}

export function setCachedSiteConfig(config: SiteConfig) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SITE_CACHE_KEY, JSON.stringify({ config, ts: Date.now() }));
  } catch {
    
  }
}

export function clearCachedSiteConfig() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SITE_CACHE_KEY);
}

function applySiteMeta(config: SiteConfig) {
  if (typeof window === 'undefined') return;

  const title = config.siteName || 'XinBlog';
  if (title) {
    document.title = title;
  }

  const description = config.shareDescription || '';
  setMeta('description', description);
  setMeta('og:title', title);
  setMeta('og:description', description);
  setMeta('og:type', 'website');
  setMeta('twitter:card', 'summary_large_image');

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareImage = config.shareImage || config.logo || `${origin}/logo.png`;
  if (shareImage) {
    const absoluteImage = shareImage.startsWith('http') || shareImage.startsWith('data:') ? shareImage : `${origin}${shareImage.startsWith('/') ? '' : '/'}${shareImage}`;
    setMeta('og:image', absoluteImage);
    setMeta('twitter:image', absoluteImage);
  }

  const faviconUrl = config.favicon || '/logo.png';
  let link = document.querySelector('link[rel*="icon"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = faviconUrl;

  applySiteFont(normalizeFontConfig(config.font));
  applySiteCursor(normalizeCursorConfig(config.cursor));
}

const FONT_STYLE_ID = 'site-custom-font';
const CURSOR_STYLE_ID = 'site-custom-cursor';

function applySiteFont(font: SiteConfig['font']) {
  if (typeof window === 'undefined') return;
  const cfg = font ? normalizeFontConfig(font) : { ...DEFAULT_FONT_CONFIG };
  const fallback = cfg.fallback;

  let style = document.getElementById(FONT_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = FONT_STYLE_ID;
    document.head.appendChild(style);
  }

  const activeFont = cfg.fonts?.find((f) => f.id === cfg.activeFontId);
  const family = activeFont?.family || '';
  const selectors =
    'body, .MuiTypography-root, .MuiFormHelperText-root, .MuiButton-root, .MuiButtonBase-root, .MuiInputBase-root, button, input, textarea, select';

  if (activeFont && activeFont.files.length > 0) {
    const src = activeFont.files
      .map((file) => `url("${file.url}") format("${file.format}")`)
      .join(',\n       ');
    const css = `@font-face {
  font-family: "${family}";
  src: ${src};
  font-display: swap;
}`;
    style.textContent = `${css}\n${selectors} { font-family: "${family}", ${fallback} !important; }`;
  } else {
    style.textContent = `${selectors} { font-family: ${fallback} !important; }`;
  }
}

interface CursorDataUrlResult {
  url: string;
  originalWidth: number;
  originalHeight: number;
}

function resizeCursorToDataUrl(url: string, size: number): Promise<CursorDataUrlResult> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve({ url, originalWidth: img.naturalWidth, originalHeight: img.naturalHeight });
        }
        ctx.drawImage(img, 0, 0, size, size);
        resolve({
          url: canvas.toDataURL('image/png'),
          originalWidth: img.naturalWidth,
          originalHeight: img.naturalHeight,
        });
      } catch {
        resolve({ url, originalWidth: img.naturalWidth, originalHeight: img.naturalHeight });
      }
    };
    img.onerror = () => resolve({ url, originalWidth: size, originalHeight: size });
    img.src = url;
  });
}

function applySiteCursor(cursor: SiteConfig['cursor']) {
  if (typeof window === 'undefined') return;
  const cfg = cursor ? normalizeCursorConfig(cursor) : { ...DEFAULT_CURSOR_CONFIG };
  const size = cfg.size;

  let style = document.getElementById(CURSOR_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = CURSOR_STYLE_ID;
    document.head.appendChild(style);
  }

  const activeCursor = cfg.cursors?.find((c) => c.id === cfg.activeCursorId);
  if (!activeCursor || activeCursor.files.length === 0) {
    style.textContent = '';
    return;
  }

  const roleMap: Record<string, { selectors: string[]; fallback: string }> = {
    default: {
      selectors: [
        'html',
        'body',
        '*',
        'iframe',
        'canvas',
        'svg',
        'video',
        'audio',
        'embed',
        'object',
      ],
      fallback: 'auto',
    },
    pointer: {
      selectors: [
        'a',
        'a *',
        'button',
        'button *',
        '[role="button"]',
        '[role="link"]',
        '[role="tab"]',
        '[role="menuitem"]',
        '[role="switch"]',
        '[role="combobox"]',
        '[role="option"]',
        'summary',
        '[type="button"]',
        '[type="submit"]',
        '[type="reset"]',
        'input[type="checkbox"]',
        'input[type="radio"]',
        'input[type="file"]',
        'label[for]',
        'select',
        '.MuiButtonBase-root',
        '.MuiButton-root',
        '.MuiLoadingButton-root',
        '.MuiIconButton-root',
        '.MuiChip-root',
        '.MuiChip-clickable',
        '.MuiListItemButton-root',
        '.MuiMenuItem-root',
        '.MuiTab-root',
        '.MuiSwitch-root',
        '.MuiCheckbox-root',
        '.MuiRadio-root',
        '.MuiSlider-root',
        '.MuiSlider-thumb',
        '.MuiAutocomplete-option',
        '.MuiSelect-select',
        '.MuiSelect-root',
        '.MuiPaginationItem-root',
        '.MuiBreadcrumbs-li a',
        '.MuiStepButton-root',
        '.MuiAccordionSummary-root',
        '.MuiDrawer-root .MuiListItem-root',
        '.MuiSpeedDialAction-staticTooltipLabel',
      ],
      fallback: 'pointer',
    },
    text: {
      selectors: [
        'input[type="text"]',
        'input[type="password"]',
        'input[type="email"]',
        'input[type="url"]',
        'input[type="search"]',
        'input[type="number"]',
        'input[type="tel"]',
        'textarea',
        '.MuiInputBase-input[type="text"]',
        '.MuiInputBase-inputMultiline',
        '[contenteditable]',
      ],
      fallback: 'text',
    },
    wait: { selectors: ['.cursor-wait', '.MuiLoadingButton-loading', '[aria-busy="true"]'], fallback: 'wait' },
    help: { selectors: ['.cursor-help'], fallback: 'help' },
    crosshair: { selectors: ['.cursor-crosshair'], fallback: 'crosshair' },
    move: { selectors: ['.cursor-move', '[draggable="true"]'], fallback: 'move' },
    'not-allowed': { selectors: ['[disabled]', '.Mui-disabled', '.cursor-not-allowed'], fallback: 'not-allowed' },
    'nesw-resize': { selectors: ['.cursor-nesw-resize'], fallback: 'nesw-resize' },
    'ns-resize': { selectors: ['.cursor-ns-resize'], fallback: 'ns-resize' },
    'nwse-resize': { selectors: ['.cursor-nwse-resize'], fallback: 'nwse-resize' },
    'ew-resize': { selectors: ['.cursor-ew-resize'], fallback: 'ew-resize' },
    'n-resize': { selectors: ['.cursor-n-resize'], fallback: 'n-resize' },
    progress: { selectors: ['.cursor-progress'], fallback: 'progress' },
  };

  const buildRules = async () => {
    const rules: string[] = [];
    for (const file of activeCursor.files) {
      if (file.format === 'ani') continue; 
      const mapping = roleMap[file.role];
      if (!mapping) continue;
      const { url, originalWidth, originalHeight } = await resizeCursorToDataUrl(file.url, size);
      
      const scaleX = originalWidth > 0 ? size / originalWidth : 1;
      const scaleY = originalHeight > 0 ? size / originalHeight : 1;
      const hotspotX = Math.round((file.hotspotX ?? 0) * scaleX);
      const hotspotY = Math.round((file.hotspotY ?? 0) * scaleY);
      rules.push(
        `${mapping.selectors.join(', ')} { cursor: url("${url}") ${hotspotX} ${hotspotY}, ${mapping.fallback} !important; }`
      );
    }
    style.textContent = rules.join('\n');
  };

  buildRules().catch(() => {
    style.textContent = '';
  });
}

function setMeta(property: string, content: string) {
  if (typeof window === 'undefined') return;
  const isOg = property.startsWith('og:') || property.startsWith('twitter:');
  const selector = isOg ? `meta[property="${property}"]` : `meta[name="${property}"]`;
  let meta = document.querySelector(selector) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    if (isOg) {
      meta.setAttribute('property', property);
    } else {
      meta.name = property;
    }
    document.head.appendChild(meta);
  }
  meta.content = content;
}

interface SiteState {
  config: SiteConfig;
  loaded: boolean;
  setConfig: (config: Partial<SiteConfig>) => void;
  loadConfig: (forceRefresh?: boolean) => Promise<void>;
  saveConfig: (config: Partial<SiteConfig>) => Promise<boolean>;
}

export const useSiteStore = create<SiteState>((set, get) => ({
  config: defaultConfig,
  loaded: false,

  setConfig: (newConfig) => set((state) => ({ config: { ...state.config, ...newConfig } })),

  loadConfig: async (forceRefresh = false) => {
    
    
    const cached = getCachedSiteConfig();
    if (cached && !forceRefresh) {
      const merged = normalizeSiteConfig({ ...defaultConfig, ...cached });
      applySiteMeta(merged);
      set({ config: merged, loaded: true });
      apiGet<{ site: SiteConfig }>(`/api/v1/site?_=${Date.now()}`)
        .then((res) => {
          if (res.code === 0 && res.data?.site) {
            const m = normalizeSiteConfig({ ...defaultConfig, ...res.data.site });
            applySiteMeta(m);
            setCachedSiteConfig(m);
            set({ config: m, loaded: true });
          }
        })
        .catch(() => {});
      return;
    }
    
    const url = `/api/v1/site?_=${Date.now()}`;
    try {
      const res = await apiGet<{ site: SiteConfig }>(url);
      if (res.code === 0 && res.data?.site) {
        const merged = normalizeSiteConfig({ ...defaultConfig, ...res.data.site });
        applySiteMeta(merged);
        setCachedSiteConfig(merged);
        set({ config: merged, loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  saveConfig: async (newConfig) => {
    const merged = normalizeSiteConfig({ ...get().config, ...newConfig });
    const res = await apiPatch('/api/v1/admin/settings', { site: merged });
    if (res.code === 0) {
      clearCachedSiteConfig();
      setCachedSiteConfig(merged);
      applySiteMeta(merged);
      set({ config: merged });
      return true;
    }
    return false;
  },
}));
