import { useEffect, useMemo, useState, useCallback } from 'react';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { GridView, ViewList, AutoStories } from '@mui/icons-material';
import { useSnackbar } from 'notistack';

// 假设这些是你项目中的实际导入路径
import { themePresets } from '@/types/theme';
import { useThemeConfigStore, getActiveColors } from '@/stores/themeConfigStore';
import { useSiteStore } from '@/stores/siteStore';
import { useUIStore } from '@/stores/uiStore';
import { fetchPosts } from '@/api/posts';
import { uploadMedia } from '@/api/media';
import { toAbsoluteCloudUrl } from '@/config';
import { getBase64Size, compressImage } from '@/utils/image';
import { DEFAULT_SPACING, resolveSpacingConfig } from '@/utils/spacingConfig';

import type {
  HeroConfig,
  AboutConfig,
  Post,
  PaginationMode,
  UserFont,
  UserFontFile,
  UserCursor,
  NavConfig,
  NavItemConfig,
  NavThemeConfig,
  ClickEffectConfig,
  SpacingConfig,
  RewardConfig,
} from '@/types';
import type { PostLayoutMode } from '@/stores/uiStore';

// ================= 常量与类型定义 =================
export type AppearanceTab = 'basic' | 'hero' | 'nav' | 'layout' | 'font' | 'cursor' | 'click' | 'spacing' | 'reward' | 'about';

const MAX_HERO_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_ICON_SIZE = 500 * 1024;            // 500KB
const MAX_SHARE_IMAGE_SIZE = 1024 * 1024;    // 1MB
const MAX_BACKGROUND_SIZE = 2 * 1024 * 1024; // 2MB
const DEFAULT_FONT_FALLBACK = 'system-ui, -apple-system, sans-serif';

const tabList = [
  { value: 'basic', label: '基础', icon: <ViewList /> },
  { value: 'hero', label: '首页', icon: <GridView /> },
  { value: 'nav', label: '导航', icon: <AutoStories /> },
  // ... 其他 tabs
  { value: 'reward', label: '打赏', icon: <GridView /> },
] as const;

// ================= 辅助函数 =================
/** 安全解析 Reward 配置，防止后端返回异常类型导致崩溃 */
function safeParseReward(raw: unknown): Partial<RewardConfig> {
  if (raw && typeof raw === 'object') {
    return raw as Partial<RewardConfig>;
  }
  return {};
}

// ================= 核心 Hook =================
export function useAppearanceEditor() {
  const site = useSiteStore();
  const themeConfig = useThemeConfigStore();
  const ui = useUIStore();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const isMobileAdmin = useMediaQuery(theme.breakpoints.down('lg'));
  
  const [tab, setTab] = useState<AppearanceTab>('basic');
  const [saving, setSaving] = useState(false);

  // ================= 1. 基础配置 State =================
  const [siteName, setSiteName] = useState(site.config.siteName || 'StarBlog');
  const [siteDescription, setSiteDescription] = useState(site.config.siteDescription || '');
  const [siteLogo, setSiteLogo] = useState(site.config.siteLogo || '');
  const [siteFavicon, setSiteFavicon] = useState(site.config.siteFavicon || '');
  const [footerText, setFooterText] = useState(site.config.footerText || '');
  const [icpBeian, setIcpBeian] = useState(site.config.icpBeian || '');
  const [policeBeian, setPoliceBeian] = useState(site.config.policeBeian || '');

  // ================= 2. 布局与文章 State =================
  const [layoutMode, setLayoutMode] = useState<PostLayoutMode>(ui.layoutMode || 'card');
  const [paginationMode, setPaginationMode] = useState<PaginationMode>(site.config.paginationMode || 'infinite');
  const [postsPerPage, setPostsPerPage] = useState(site.config.postsPerPage || 10);
  const [posts, setPosts] = useState<Post[]>([]);

  // ================= 3. Hero / Nav / About State =================
  const [heroConfig, setHeroConfig] = useState<HeroConfig>(site.config.heroConfig || { title: '', subtitle: '' });
  const [navConfig, setNavConfig] = useState<NavConfig>(site.config.navConfig || { items: [], theme: {} });
  const [aboutConfig, setAboutConfig] = useState<AboutConfig>(site.config.aboutConfig || { content: '' });

  // ================= 4. 字体 / 鼠标 / 点击效果 / 间距 State =================
  const [userFont, setUserFont] = useState<UserFont | null>(site.config.userFont || null);
  const [userCursor, setUserCursor] = useState<UserCursor | null>(site.config.userCursor || null);
  const [clickEffect, setClickEffect] = useState<ClickEffectConfig>(site.config.clickEffect || { enabled: false, type: 'heart' });
  const [spacing, setSpacing] = useState<SpacingConfig>(site.config.spacing || DEFAULT_SPACING);
  
  // 点击效果拆解 (为了表单控件绑定)
  const [clickEffectEnabled, setClickEffectEnabled] = useState(clickEffect.enabled ?? false);
  const [clickEffectType, setClickEffectType] = useState(clickEffect.type ?? 'heart');
  const [clickEffectColorMode, setClickEffectColorMode] = useState(clickEffect.colorMode ?? 'theme');
  const [clickEffectCustomColor, setClickEffectCustomColor] = useState(clickEffect.customColor ?? '#ff0000');
  const [clickEffectTextList, setClickEffectTextList] = useState((clickEffect.textList || []).join('\n'));
  const [clickEffectIntensity, setClickEffectIntensity] = useState(clickEffect.intensity ?? 1);

  // ================= 5. 打赏 (Reward) State [已优化] =================
  // 使用 JSON 序列化作为稳定的依赖项，避免对象引用变化导致无限循环
  const rewardConfigJson = useMemo(
    () => JSON.stringify(site.config.reward ?? {}),
    [site.config.reward]
  );

  const [reward, setReward] = useState<RewardConfig>(() => {
    const cfg = safeParseReward(site.config.reward);
    return {
      enabled: cfg.enabled ?? false,
      title: cfg.title ?? '',
      tip: cfg.tip ?? '',
      alipayQr: cfg.alipayQr ?? '',
      wechatQr: cfg.wechatQr ?? '',
    };
  });

  // ================= 6. 同步 Effects =================
  
  // 6.1 Reward 同步 (仅在服务端配置真正变化时触发)
  useEffect(() => {
    const cfg = safeParseReward(JSON.parse(rewardConfigJson));
    setReward({
      enabled: cfg.enabled ?? false,
      title: cfg.title ?? '',
      tip: cfg.tip ?? '',
      alipayQr: cfg.alipayQr ?? '',
      wechatQr: cfg.wechatQr ?? '',
    });
  }, [rewardConfigJson]);

  // 6.2 全局配置大同步 (当 site.config 整体刷新时，如切换站点或首次加载完成)
  useEffect(() => {
    const c = site.config;
    setSiteName(c.siteName || 'StarBlog');
    setSiteDescription(c.siteDescription || '');
    setSiteLogo(c.siteLogo || '');
    setSiteFavicon(c.siteFavicon || '');
    setFooterText(c.footerText || '');
    setIcpBeian(c.icpBeian || '');
    setPoliceBeian(c.policeBeian || '');
    
    setHeroConfig(c.heroConfig || { title: '', subtitle: '' });
    setNavConfig(c.navConfig || { items: [], theme: {} });
    setAboutConfig(c.aboutConfig || { content: '' });
    
    // ... 其他字段同步 ...
    
    // 注意：Reward 已经通过上面的 rewardConfigJson effect 独立同步，此处无需重复
  }, [site.config.id, site.config.updatedAt]); // 依赖站点ID和更新时间，避免频繁触发

  // 6.3 文章获取
  useEffect(() => {
    fetchPosts({ page: 1, limit: 10 }).then(res => {
      if (res.data) setPosts(res.data);
    }).catch(() => {});
  }, []);

  // ================= 7. 计算属性 =================
  const activeColors = useMemo(() => getActiveColors(themeConfig), [themeConfig]);

  // isDirty 检查 [已优化：直接使用可选链，避免创建临时对象]
  const isDirty = useMemo(() => {
    const c = site.config;
    
    // 基础信息
    if (siteName !== (c.siteName || 'StarBlog')) return true;
    if (siteDescription !== (c.siteDescription || '')) return true;
    if (siteLogo !== (c.siteLogo || '')) return true;
    if (footerText !== (c.footerText || '')) return true;
    if (policeBeian !== (c.policeBeian || '')) return true;
    
    // ... 其他字段的 dirty 检查 (Hero, Nav, Layout 等) ...

    // Reward 检查
    const r = c.reward;
    if (reward.enabled !== (r?.enabled ?? false)) return true;
    if (reward.title !== (r?.title ?? '')) return true;
    if (reward.tip !== (r?.tip ?? '')) return true;
    if (reward.alipayQr !== (r?.alipayQr ?? '')) return true;
    if (reward.wechatQr !== (r?.wechatQr ?? '')) return true;

    return false;
  }, [
    site.config, 
    siteName, siteDescription, siteLogo, footerText, policeBeian,
    reward,
    // ... 其他依赖项
  ]);

  // ================= 8. Handlers =================
  
  const handleImageUpload = useCallback(async (file: File, maxSize: number) => {
    if (file.size > maxSize) {
      enqueueSnackbar(`图片大小不能超过 ${(maxSize / 1024 / 1024).toFixed(1)}MB`, { variant: 'error' });
      return null;
    }
    try {
      const compressed = await compressImage(file);
      const res = await uploadMedia(compressed);
      return toAbsoluteCloudUrl(res.data.url);
    } catch (e) {
      enqueueSnackbar('图片上传失败', { variant: 'error' });
      return null;
    }
  }, [enqueueSnackbar]);

  const updateSpacing = useCallback((key: keyof SpacingConfig, value: number) => {
    setSpacing(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetSpacing = useCallback(() => {
    setSpacing(DEFAULT_SPACING);
  }, []);

  // ================= 9. 保存逻辑 =================
  const applyAll = async () => {
    setSaving(true);

    try {
      // 构建点击效果配置
      const clickEffectConfig: ClickEffectConfig = {
        enabled: clickEffectEnabled,
        type: clickEffectType,
        colorMode: clickEffectColorMode,
        customColor: clickEffectCustomColor,
        textList: clickEffectTextList.split(/\n/).map((t) => t.trim()).filter(Boolean),
        intensity: clickEffectIntensity,
      };

      // 构建完整 SiteConfig
      const siteConfig = {
        siteName,
        siteDescription,
        siteLogo,
        siteFavicon,
        footerText,
        icpBeian,
        policeBeian,
        heroConfig,
        navConfig,
        aboutConfig,
        clickEffect: clickEffectConfig,
        spacing,
        reward, // 写入打赏配置
        // ... 其他字段
      };

      const siteOk = await site.saveConfig(siteConfig);

      if (siteOk) {
        enqueueSnackbar('保存成功', { variant: 'success' });
        
        // [关键修复] 保存成功后，用服务端实际存储的数据重置本地 state
        // 防止服务端对数据进行了清洗、默认值填充或格式化
        const sc = site.config; // 假设 saveConfig 内部已经更新了 store
        
        const savedReward = safeParseReward(sc.reward);
        setReward({
          enabled: savedReward.enabled ?? false,
          title: savedReward.title ?? '',
          tip: savedReward.tip ?? '',
          alipayQr: savedReward.alipayQr ?? '',
          wechatQr: savedReward.wechatQr ?? '',
        });
        
        // ... 重置其他 state (如 clickEffect, spacing 等) ...
      } else {
        enqueueSnackbar('保存失败，请重试', { variant: 'error' });
      }
    } catch (error) {
      console.error('Save config error:', error);
      enqueueSnackbar('保存过程中发生错误', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // ================= 10. 导出 =================
  return {
    // UI 状态
    tab,
    setTab,
    saving,
    isDirty,
    isMobileAdmin,
    activeColors,
    posts,
    
    // 基础配置
    siteName, setSiteName,
    siteDescription, setSiteDescription,
    siteLogo, setSiteLogo,
    footerText, setFooterText,
    policeBeian, setPoliceBeian,
    // ... 其他基础字段

    // 布局与模块配置
    layoutMode, setLayoutMode,
    heroConfig, setHeroConfig,
    navConfig, setNavConfig,
    aboutConfig, setAboutConfig,

    // 打赏配置 (Reward)
    reward,
    setReward,

    // 点击效果
    clickEffectEnabled, setClickEffectEnabled,
    clickEffectType, setClickEffectType,
    clickEffectColorMode, setClickEffectColorMode,
    clickEffectCustomColor, setClickEffectCustomColor,
    clickEffectTextList, setClickEffectTextList,
    clickEffectIntensity, setClickEffectIntensity,

    // 间距
    spacing,
    updateSpacing,
    resetSpacing,

    // Handlers
    handleImageUpload,
    applyAll,

    // 常量
    MAX_HERO_IMAGE_SIZE,
    MAX_ICON_SIZE,
    MAX_SHARE_IMAGE_SIZE,
    MAX_BACKGROUND_SIZE,
    DEFAULT_FONT_FALLBACK,
    tabList,
  };
}

export type AppearanceEditor = ReturnType<typeof useAppearanceEditor>;
