import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { GridView, ViewList, AutoStories } from '@mui/icons-material';
import { themePresets } from '@/types/theme';
import { useThemeConfigStore, getActiveColors } from '@/stores/themeConfigStore';
import { useSiteStore } from '@/stores/siteStore';
import { useUIStore } from '@/stores/uiStore';
import { fetchPosts } from '@/api/posts';
import { uploadMedia } from '@/api/media';
import { useSnackbar } from 'notistack';
import type { HeroConfig, AboutConfig, Post, PaginationMode, UserFont, UserCursor } from '@/types';
import type { PostLayoutMode } from '@/stores/uiStore';
import { toAbsoluteCloudUrl } from '@/config';
import { getBase64Size, compressImage } from '@/utils/image';

const MAX_HERO_IMAGE_SIZE = 500 * 1024;
const MAX_ICON_SIZE = 100 * 1024;
const MAX_SHARE_IMAGE_SIZE = 100 * 1024;
const MAX_BACKGROUND_SIZE = 600 * 1024;

const DEFAULT_FONT_FALLBACK =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const toAbsoluteFontUrl = toAbsoluteCloudUrl;

export type AppearanceTab = 'theme' | 'font' | 'cursor' | 'hero' | 'about' | 'basic' | 'layout';

export const tabList: { value: AppearanceTab; label: string }[] = [
  { value: 'basic', label: '基础设置' },
  { value: 'hero', label: '主页英雄区' },
  { value: 'about', label: '关于页面' },
  { value: 'cursor', label: '鼠标' },
  { value: 'layout', label: '文章布局' },
  { value: 'theme', label: '配色' },
  { value: 'font', label: '字体' },
];

export const layouts: { id: PostLayoutMode; name: string; desc: string; icon: React.ReactNode }[] = [
  {
    id: 'grid',
    name: '网格卡片',
    desc: '三列等宽卡片，适合图片较多的博客',
    icon: <GridView sx={{ fontSize: { xs: 28, md: 40 } }} />,
  },
  {
    id: 'list',
    name: '横向列表',
    desc: '大图 + 文字左右交替排列，大气高级',
    icon: <ViewList sx={{ fontSize: { xs: 28, md: 40 } }} />,
  },
  {
    id: 'magazine',
    name: '杂志布局',
    desc: '首篇精选大卡片，其余双列展示',
    icon: <AutoStories sx={{ fontSize: { xs: 28, md: 40 } }} />,
  },
];


export function useAppearanceEditor() {
  const site = useSiteStore();
  const themeConfig = useThemeConfigStore();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const isMobileAdmin = useMediaQuery(theme.breakpoints.down('lg'));
  const [tab, setTab] = useState<AppearanceTab>('basic');
  const [saving, setSaving] = useState(false);

  
  const ui = useUIStore();
  const [postLayout, setPostLayout] = useState<PostLayoutMode>(
    site.config.postLayout || ui.postLayout || 'grid'
  );
  const [previewPosts, setPreviewPosts] = useState<Post[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  
  const fontCfg = site.config.font || {};
  const [userFonts, setUserFonts] = useState<UserFont[]>(fontCfg.fonts || []);
  const [activeFontId, setActiveFontId] = useState<string>(fontCfg.activeFontId || '');
  const [fontStoreOpen, setFontStoreOpen] = useState(false);
  const [storeFonts, setStoreFonts] = useState<UserFont[]>([]);
  const [storeLoading, setStoreLoading] = useState(false);
  const [fontActionLoading, setFontActionLoading] = useState(false);
  const [fontPreviewText, setFontPreviewText] = useState(
    '落霞与孤鹜齐飞，秋水共长天一色。Hello World! 1234567890 · @#￥%……&*（）'
  );
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'add' | 'remove';
    font: UserFont | null;
  }>({ open: false, type: 'add', font: null });

  
  const cursorCfg = site.config.cursor || {};
  const [userCursors, setUserCursors] = useState<UserCursor[]>(cursorCfg.cursors || []);
  const [activeCursorId, setActiveCursorId] = useState<string>(cursorCfg.activeCursorId || '');
  const [cursorSize, setCursorSize] = useState<number>(cursorCfg.size || 32);
  const [previewCursorUrl, setPreviewCursorUrl] = useState<string>('');
  const activeCursor = userCursors.find((c) => c.id === activeCursorId);
  const [cursorStoreOpen, setCursorStoreOpen] = useState(false);
  const [storeCursors, setStoreCursors] = useState<UserCursor[]>([]);
  const [cursorStoreLoading, setCursorStoreLoading] = useState(false);
  const [cursorActionLoading, setCursorActionLoading] = useState(false);
  const [cursorConfirmDialog, setCursorConfirmDialog] = useState<{
    open: boolean;
    type: 'add' | 'remove';
    cursor: UserCursor | null;
  }>({ open: false, type: 'add', cursor: null });

  useEffect(() => {
    const layout = site.config.postLayout || ui.postLayout;
    if (layout && ['grid', 'list', 'magazine'].includes(layout)) {
      setPostLayout(layout);
    }
  }, [site.config.postLayout, ui.postLayout]);

  useEffect(() => {
    const cfg = site.config.font || {};
    setUserFonts(cfg.fonts || []);
    setActiveFontId(cfg.activeFontId || '');
  }, [site.config.font]);

  useEffect(() => {
    const cfg = site.config.cursor || {};
    setUserCursors(cfg.cursors || []);
    setActiveCursorId(cfg.activeCursorId || '');
    setCursorSize(cfg.size || 32);
  }, [site.config.cursor]);

  useEffect(() => {
    if (!activeCursor) {
      setPreviewCursorUrl('');
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = cursorSize;
        canvas.height = cursorSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, cursorSize, cursorSize);
        if (!cancelled) setPreviewCursorUrl(canvas.toDataURL('image/png'));
      } catch {
        if (!cancelled) setPreviewCursorUrl(activeCursor.preview);
      }
    };
    img.onerror = () => {
      if (!cancelled) setPreviewCursorUrl(activeCursor.preview);
    };
    img.src = activeCursor.preview;
    return () => {
      cancelled = true;
    };
  }, [activeCursor, cursorSize]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const active = userFonts.find((f) => f.id === activeFontId);
    const styleId = 'site-font-preview';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    if (active && active.files.length > 0) {
      const src = active.files
        .map((file) => `url("${file.url}") format("${file.format}")`)
        .join(', ');
      style.textContent = `@font-face { font-family: "${active.family}"; src: ${src}; font-display: swap; }`;
    } else {
      style.textContent = '';
    }
    return () => {
      const el = document.getElementById(styleId);
      if (el) el.textContent = '';
    };
  }, [userFonts, activeFontId]);

  useEffect(() => {
    let mounted = true;
    setPreviewLoading(true);
    fetchPosts().then((data) => {
      if (!mounted) return;
      setPreviewPosts(data.slice(0, 6));
      setPreviewLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  
  const [presetId, setPresetId] = useState(themeConfig.presetId);
  const [useCustom, setUseCustom] = useState(themeConfig.useCustomColors);
  const [colors, setColors] = useState(themeConfig.customColors);
  const [borderRadius, setBorderRadius] = useState(themeConfig.borderRadius);

  
  const [siteName, setSiteName] = useState(site.config.siteName || 'StarBlog');
  const [author, setAuthor] = useState(site.config.author);
  const [shareDescription, setShareDescription] = useState(site.config.shareDescription || '');
  const [shareImage, setShareImage] = useState(site.config.shareImage || '');
  const [footerText, setFooterText] = useState(site.config.footerText || '');
  const [logo, setLogo] = useState(site.config.logo || '');
  const [favicon, setFavicon] = useState(site.config.favicon || '');
  const [backgroundImage, setBackgroundImage] = useState(site.config.backgroundImage || '');
  const [backgroundOpacity, setBackgroundOpacity] = useState(site.config.backgroundOpacity ?? 1);
  const [backgroundBlur, setBackgroundBlur] = useState(site.config.backgroundBlur ?? 0);
  const [paginationMode, setPaginationMode] = useState<PaginationMode>(site.config.paginationMode || 'load-more');
  const [pageSize, setPageSize] = useState(site.config.pageSize ?? 9);

  
  const hero = site.config.hero || {};
  const [heroTitle, setHeroTitle] = useState(hero.title ?? '');
  const [heroSubtitle, setHeroSubtitle] = useState(hero.subtitle ?? '');
  const [heroBadge, setHeroBadge] = useState(hero.badge ?? '');
  const [heroBgImage, setHeroBgImage] = useState(hero.backgroundImage ?? '');
  const [heroBgColor, setHeroBgColor] = useState(hero.backgroundColor ?? '');

  
  const about = site.config.about || {};
  const [aboutSubtitle, setAboutSubtitle] = useState(about.subtitle ?? '');
  const [aboutBio, setAboutBio] = useState(about.bio ?? '');
  const [aboutTags, setAboutTags] = useState((about.tags ?? []).join('、'));

  useEffect(() => {
    const c = site.config;
    setSiteName(c.siteName || 'StarBlog');
    setAuthor(c.author);
    setShareDescription(c.shareDescription || '');
    setShareImage(c.shareImage || '');
    setFooterText(c.footerText || '');
    setLogo(c.logo || '');
    setFavicon(c.favicon || '');
    setBackgroundImage(c.backgroundImage || '');
    setBackgroundOpacity(c.backgroundOpacity ?? 1);
    setBackgroundBlur(c.backgroundBlur ?? 0);
    setPaginationMode(c.paginationMode || 'load-more');
    setPageSize(c.pageSize ?? 9);
    const heroCfg = c.hero || {};
    setHeroTitle(heroCfg.title ?? '');
    setHeroSubtitle(heroCfg.subtitle ?? '');
    setHeroBadge(heroCfg.badge ?? '');
    setHeroBgImage(heroCfg.backgroundImage ?? '');
    setHeroBgColor(heroCfg.backgroundColor ?? '');
    const aboutCfg = c.about || {};
    setAboutSubtitle(aboutCfg.subtitle ?? '');
    setAboutBio(aboutCfg.bio ?? '');
    setAboutTags((aboutCfg.tags ?? []).join('、'));
    const themeCfg = c.theme;
    if (themeCfg) {
      setPresetId(themeCfg.presetId ?? themeConfig.presetId);
      setUseCustom(themeCfg.useCustomColors ?? themeConfig.useCustomColors);
      setColors(themeCfg.customColors ?? themeConfig.customColors);
      setBorderRadius(themeCfg.borderRadius ?? themeConfig.borderRadius);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site.config]);

  const activeColors = getActiveColors({
    ...themeConfig,
    presetId,
    useCustomColors: useCustom,
    customColors: colors,
  });

  const isDirty = useMemo(() => {
    const currentHero = site.config.hero || {};
    const currentAbout = site.config.about || {};
    const currentTags = (currentAbout.tags ?? []).join('、');
    const currentLayout = site.config.postLayout || ui.postLayout || 'grid';

    if (presetId !== themeConfig.presetId) return true;
    if (useCustom !== themeConfig.useCustomColors) return true;
    if (borderRadius !== themeConfig.borderRadius) return true;
    if (JSON.stringify(colors) !== JSON.stringify(themeConfig.customColors)) return true;

    if (siteName !== (site.config.siteName || 'StarBlog')) return true;
    if (author !== site.config.author) return true;
    if (shareDescription !== (site.config.shareDescription || '')) return true;
    if (shareImage !== (site.config.shareImage || '')) return true;
    if (footerText !== (site.config.footerText || '')) return true;
    if (logo !== (site.config.logo || '')) return true;
    if (favicon !== (site.config.favicon || '')) return true;
    if (backgroundImage !== (site.config.backgroundImage || '')) return true;
    if (backgroundOpacity !== (site.config.backgroundOpacity ?? 1)) return true;
    if (backgroundBlur !== (site.config.backgroundBlur ?? 0)) return true;
    if (paginationMode !== (site.config.paginationMode || 'load-more')) return true;
    if (pageSize !== (site.config.pageSize ?? 9)) return true;

    if (heroTitle !== (currentHero.title ?? '')) return true;
    if (heroSubtitle !== (currentHero.subtitle ?? '')) return true;
    if (heroBadge !== (currentHero.badge ?? '')) return true;
    if (heroBgImage !== (currentHero.backgroundImage ?? '')) return true;
    if (heroBgColor !== (currentHero.backgroundColor ?? '')) return true;

    if (aboutSubtitle !== (currentAbout.subtitle ?? '')) return true;
    if (aboutBio !== (currentAbout.bio ?? '')) return true;
    if (aboutTags !== currentTags) return true;

    if (postLayout !== currentLayout) return true;

    const currentFont = site.config.font || {};
    if (
      JSON.stringify(activeFontId) !== JSON.stringify(currentFont.activeFontId || '') ||
      JSON.stringify(userFonts) !== JSON.stringify(currentFont.fonts || [])
    ) {
      return true;
    }

    const currentCursor = site.config.cursor || {};
    if (
      JSON.stringify(activeCursorId) !== JSON.stringify(currentCursor.activeCursorId || '') ||
      JSON.stringify(userCursors) !== JSON.stringify(currentCursor.cursors || []) ||
      cursorSize !== (currentCursor.size || 32)
    ) {
      return true;
    }

    return false;
  }, [
    presetId,
    useCustom,
    colors,
    borderRadius,
    themeConfig.presetId,
    themeConfig.useCustomColors,
    themeConfig.customColors,
    themeConfig.borderRadius,
    siteName,
    author,
    shareDescription,
    shareImage,
    footerText,
    logo,
    favicon,
    heroTitle,
    heroSubtitle,
    heroBadge,
    heroBgImage,
    heroBgColor,
    aboutSubtitle,
    aboutBio,
    aboutTags,
    postLayout,
    site.config.siteName,
    site.config.author,
    site.config.shareDescription,
    site.config.shareImage,
    site.config.footerText,
    site.config.logo,
    site.config.favicon,
    site.config.backgroundImage,
    site.config.backgroundOpacity,
    site.config.backgroundBlur,
    site.config.paginationMode,
    site.config.pageSize,
    site.config.hero,
    site.config.about,
    site.config.postLayout,
    ui.postLayout,
    backgroundImage,
    backgroundOpacity,
    backgroundBlur,
    paginationMode,
    pageSize,
    userFonts,
    activeFontId,
    site.config.font,
    userCursors,
    activeCursorId,
    cursorSize,
    site.config.cursor,
  ]);

  const resetToPreset = (id: string) => {
    const preset = themePresets.find((p) => p.id === id);
    if (preset) {
      setPresetId(id);
      setUseCustom(false);
      setColors({ ...preset.colors });
    }
  };

  const handleColorChange = (key: keyof import('@/types/theme').ThemeColorConfig, value: string) => {
    setColors((prev) => ({ ...prev, [key]: value }));
    setUseCustom(true);
  };

  const handleImageUpload = async (
    file: File,
    targetSize: number,
    setter: (url: string) => void,
    label: string
  ) => {
    try {
      const base64 = await compressImage(file, targetSize);
      if (getBase64Size(base64) > targetSize) {
        enqueueSnackbar(`${label}压缩后仍超过限制`, { variant: 'error' });
        return;
      }
      const media = await uploadMedia(file.name, base64);
      setter(media.url);
      enqueueSnackbar(`${label}上传成功`, { variant: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : `${label}处理失败`;
      enqueueSnackbar(msg, { variant: 'error' });
    }
  };

  const applyAll = async () => {
    setSaving(true);

    const heroConfig: HeroConfig = {
      title: heroTitle,
      subtitle: heroSubtitle,
      badge: heroBadge,
      backgroundImage: heroBgImage,
      backgroundColor: heroBgColor,
    };

    const aboutConfig: AboutConfig = {
      subtitle: aboutSubtitle,
      bio: aboutBio,
      tags: aboutTags
        .split(/[、,，]/)
        .map((t) => t.trim())
        .filter(Boolean),
    };

    const siteConfig = {
      siteName,
      author,
      shareDescription,
      shareImage,
      footerText,
      logo,
      favicon,
      backgroundImage,
      backgroundOpacity,
      backgroundBlur,
      paginationMode,
      pageSize,
      hero: heroConfig,
      about: aboutConfig,
      theme: {
        presetId,
        useCustomColors: useCustom,
        customColors: colors,
        borderRadius,
      },
      postLayout,
      font: {
        activeFontId,
        fonts: userFonts,
        fallback: DEFAULT_FONT_FALLBACK,
      },
      cursor: {
        activeCursorId,
        cursors: userCursors,
        size: cursorSize,
      },
    };

    const siteOk = await site.saveConfig(siteConfig);

    if (siteOk) {
      useSiteStore.setState((state) => ({
        config: { ...state.config, ...siteConfig },
      }));
      useThemeConfigStore.setState({
        presetId,
        useCustomColors: useCustom,
        customColors: colors,
        borderRadius,
      });
      ui.setPostLayout(postLayout);

      const sc = useSiteStore.getState().config;
      const tc = useThemeConfigStore.getState();
      setSiteName(sc.siteName || 'StarBlog');
      setAuthor(sc.author);
      setShareDescription(sc.shareDescription || '');
      setShareImage(sc.shareImage || '');
      setFooterText(sc.footerText || '');
      setLogo(sc.logo || '');
      setFavicon(sc.favicon || '');
      setBackgroundImage(sc.backgroundImage || '');
      setBackgroundOpacity(sc.backgroundOpacity ?? 1);
      setBackgroundBlur(sc.backgroundBlur ?? 0);
      setPaginationMode(sc.paginationMode || 'load-more');
      setPageSize(sc.pageSize ?? 9);
      const savedHero = sc.hero || {};
      setHeroTitle(savedHero.title ?? '');
      setHeroSubtitle(savedHero.subtitle ?? '');
      setHeroBadge(savedHero.badge ?? '');
      setHeroBgImage(savedHero.backgroundImage ?? '');
      setHeroBgColor(savedHero.backgroundColor ?? '');
      const savedAbout = sc.about || {};
      setAboutSubtitle(savedAbout.subtitle ?? '');
      setAboutBio(savedAbout.bio ?? '');
      setAboutTags((savedAbout.tags ?? []).join('、'));
      const savedTheme = sc.theme;
      if (savedTheme) {
        setPresetId(savedTheme.presetId ?? tc.presetId);
        setUseCustom(savedTheme.useCustomColors ?? tc.useCustomColors);
        setColors(savedTheme.customColors ?? tc.customColors);
        setBorderRadius(savedTheme.borderRadius ?? tc.borderRadius);
      }
      setPostLayout(sc.postLayout || ui.postLayout || 'grid');
      setUserFonts(sc.font?.fonts || []);
      setActiveFontId(sc.font?.activeFontId || '');
      setUserCursors(sc.cursor?.cursors || []);
      setActiveCursorId(sc.cursor?.activeCursorId || '');
      setCursorSize(sc.cursor?.size || 32);
    }

    setSaving(false);

    if (siteOk) {
      enqueueSnackbar('外观设置已保存', { variant: 'success' });
    } else {
      enqueueSnackbar('保存失败，请稍后再试', { variant: 'error' });
    }
  };

  
  const activeFont = userFonts.find((f) => f.id === activeFontId);
  const handleOpenFontStore = (forceRefresh = false) => {
    setFontStoreOpen(true);
    if (storeFonts.length > 0 && !forceRefresh) {
      return;
    }
    setStoreLoading(true);
    const cacheBuster = `?t=${Date.now()}`;
    fetch(toAbsoluteFontUrl(`/resources/fonts/fonts.json${cacheBuster}`))
      .then((res) => {
        if (!res.ok) throw new Error('加载失败');
        return res.json();
      })
      .then((list: UserFont[]) => {
        setStoreFonts(
          list.map((f) => ({
            ...f,
            preview: toAbsoluteFontUrl(f.preview),
            files: f.files.map((file) => ({
              ...file,
              url: toAbsoluteFontUrl(file.url),
            })),
          }))
        );
      })
      .catch(() => {
        enqueueSnackbar('字体商店加载失败，请检查服务站地址与跨域配置', { variant: 'error' });
      })
      .finally(() => setStoreLoading(false));
  };

  const saveFontConfig = async (
    nextFonts: UserFont[],
    nextActiveFontId: string,
    successMsg: string
  ) => {
    setFontActionLoading(true);
    const ok = await site.saveConfig({
      font: {
        activeFontId: nextActiveFontId,
        fonts: nextFonts,
        fallback: DEFAULT_FONT_FALLBACK,
      },
    });
    setFontActionLoading(false);
    if (ok) {
      enqueueSnackbar(successMsg, { variant: 'success' });
    } else {
      enqueueSnackbar('字体操作失败，请稍后再试', { variant: 'error' });
    }
    return ok;
  };

  const handleAddFont = (font: UserFont) => {
    if (userFonts.some((f) => f.id === font.id) || fontActionLoading) return;
    setConfirmDialog({ open: true, type: 'add', font });
  };

  const handleRemoveFont = (id: string) => {
    if (fontActionLoading) return;
    const font = userFonts.find((f) => f.id === id);
    if (!font) return;
    setConfirmDialog({ open: true, type: 'remove', font });
  };

  const handleConfirmFontAction = async () => {
    const { type, font } = confirmDialog;
    if (!font) return;
    setConfirmDialog((prev) => ({ ...prev, open: false }));

    if (type === 'add') {
      const nextFonts = [...userFonts, font];
      const nextActiveFontId = activeFontId || font.id;
      setUserFonts(nextFonts);
      setActiveFontId(nextActiveFontId);
      await saveFontConfig(nextFonts, nextActiveFontId, `已添加字体“${font.name}”`);
    } else {
      const nextFonts = userFonts.filter((f) => f.id !== font.id);
      const nextActiveFontId = activeFontId === font.id ? nextFonts[0]?.id || '' : activeFontId;
      setUserFonts(nextFonts);
      setActiveFontId(nextActiveFontId);
      await saveFontConfig(nextFonts, nextActiveFontId, '字体已移除');
    }
  };

  const handleResetSystemFont = () => {
    if (!activeFontId || fontActionLoading) return;
    setActiveFontId('');
  };

  const handleActivateFont = (id: string) => {
    if (activeFontId === id || fontActionLoading) return;
    setActiveFontId(id);
  };

  
  const handleOpenCursorStore = (forceRefresh = false) => {
    setCursorStoreOpen(true);
    if (storeCursors.length > 0 && !forceRefresh) {
      return;
    }
    setCursorStoreLoading(true);
    const cacheBuster = `?t=${Date.now()}`;
    fetch(toAbsoluteCloudUrl(`/resources/cursors/cursors.json${cacheBuster}`))
      .then((res) => {
        if (!res.ok) throw new Error('加载失败');
        return res.json();
      })
      .then((list: UserCursor[]) => {
        setStoreCursors(
          list.map((c) => ({
            ...c,
            preview: toAbsoluteCloudUrl(c.preview),
            files: c.files.map((file) => ({
              ...file,
              url: toAbsoluteCloudUrl(file.url),
            })),
          }))
        );
      })
      .catch(() => {
        enqueueSnackbar('鼠标商店加载失败，请检查服务站地址与跨域配置', { variant: 'error' });
      })
      .finally(() => setCursorStoreLoading(false));
  };

  const saveCursorConfig = async (
    nextCursors: UserCursor[],
    nextActiveCursorId: string,
    successMsg: string
  ) => {
    setCursorActionLoading(true);
    const ok = await site.saveConfig({
      cursor: {
        activeCursorId: nextActiveCursorId,
        cursors: nextCursors,
        size: cursorSize,
      },
    });
    setCursorActionLoading(false);
    if (ok) {
      enqueueSnackbar(successMsg, { variant: 'success' });
    } else {
      enqueueSnackbar('鼠标操作失败，请稍后再试', { variant: 'error' });
    }
    return ok;
  };

  const handleAddCursor = (cursor: UserCursor) => {
    if (userCursors.some((c) => c.id === cursor.id) || cursorActionLoading) return;
    setCursorConfirmDialog({ open: true, type: 'add', cursor });
  };

  const handleRemoveCursor = (id: string) => {
    if (cursorActionLoading) return;
    const cursor = userCursors.find((c) => c.id === id);
    if (!cursor) return;
    setCursorConfirmDialog({ open: true, type: 'remove', cursor });
  };

  const handleConfirmCursorAction = async () => {
    const { type, cursor } = cursorConfirmDialog;
    if (!cursor) return;
    setCursorConfirmDialog((prev) => ({ ...prev, open: false }));

    if (type === 'add') {
      const nextCursors = [...userCursors, cursor];
      const nextActiveCursorId = activeCursorId || cursor.id;
      setUserCursors(nextCursors);
      setActiveCursorId(nextActiveCursorId);
      await saveCursorConfig(nextCursors, nextActiveCursorId, `已添加鼠标“${cursor.name}”`);
    } else {
      const nextCursors = userCursors.filter((c) => c.id !== cursor.id);
      const nextActiveCursorId = activeCursorId === cursor.id ? nextCursors[0]?.id || '' : activeCursorId;
      setUserCursors(nextCursors);
      setActiveCursorId(nextActiveCursorId);
      await saveCursorConfig(nextCursors, nextActiveCursorId, '鼠标已移除');
    }
  };

  const handleResetSystemCursor = () => {
    if (!activeCursorId || cursorActionLoading) return;
    setActiveCursorId('');
  };

  const handleActivateCursor = (id: string) => {
    if (activeCursorId === id || cursorActionLoading) return;
    setActiveCursorId(id);
  };

  return {
    
    site,
    themeConfig,
    ui,
    theme,
    isMobileAdmin,
    enqueueSnackbar,
    
    tab,
    setTab,
    saving,
    setSaving,
    
    postLayout,
    setPostLayout,
    previewPosts,
    previewLoading,
    
    userFonts,
    setUserFonts,
    activeFontId,
    setActiveFontId,
    activeFont,
    fontStoreOpen,
    setFontStoreOpen,
    storeFonts,
    storeLoading,
    fontActionLoading,
    fontPreviewText,
    setFontPreviewText,
    confirmDialog,
    setConfirmDialog,
    handleOpenFontStore,
    handleAddFont,
    handleRemoveFont,
    handleConfirmFontAction,
    handleResetSystemFont,
    handleActivateFont,
    
    userCursors,
    setUserCursors,
    activeCursorId,
    setActiveCursorId,
    activeCursor,
    cursorSize,
    setCursorSize,
    previewCursorUrl,
    cursorStoreOpen,
    setCursorStoreOpen,
    storeCursors,
    cursorStoreLoading,
    cursorActionLoading,
    cursorConfirmDialog,
    setCursorConfirmDialog,
    handleOpenCursorStore,
    handleAddCursor,
    handleRemoveCursor,
    handleConfirmCursorAction,
    handleResetSystemCursor,
    handleActivateCursor,
    
    presetId,
    setPresetId,
    useCustom,
    setUseCustom,
    colors,
    setColors,
    borderRadius,
    setBorderRadius,
    activeColors,
    resetToPreset,
    handleColorChange,
    
    siteName,
    setSiteName,
    author,
    setAuthor,
    shareDescription,
    setShareDescription,
    shareImage,
    setShareImage,
    footerText,
    setFooterText,
    logo,
    setLogo,
    favicon,
    setFavicon,
    backgroundImage,
    setBackgroundImage,
    backgroundOpacity,
    setBackgroundOpacity,
    backgroundBlur,
    setBackgroundBlur,
    paginationMode,
    setPaginationMode,
    pageSize,
    setPageSize,
    
    heroTitle,
    setHeroTitle,
    heroSubtitle,
    setHeroSubtitle,
    heroBadge,
    setHeroBadge,
    heroBgImage,
    setHeroBgImage,
    heroBgColor,
    setHeroBgColor,
    
    aboutSubtitle,
    setAboutSubtitle,
    aboutBio,
    setAboutBio,
    aboutTags,
    setAboutTags,
    
    isDirty,
    handleImageUpload,
    applyAll,
    
    MAX_HERO_IMAGE_SIZE,
    MAX_ICON_SIZE,
    MAX_SHARE_IMAGE_SIZE,
    MAX_BACKGROUND_SIZE,
    DEFAULT_FONT_FALLBACK,
  };
}

export type AppearanceEditor = ReturnType<typeof useAppearanceEditor>;
