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
// ===== 新增：导入 RewardConfig 类型 =====
import type { HeroConfig, AboutConfig, Post, PaginationMode, UserFont, UserFontFile, UserCursor, NavConfig, NavItemConfig, NavThemeConfig, ClickEffectConfig, SpacingConfig, RewardConfig } from '@/types';
import { DEFAULT_SPACING, resolveSpacingConfig } from '@/utils/spacingConfig';
import type { PostLayoutMode } from '@/stores/uiStore';
import { toAbsoluteCloudUrl } from '@/config';
import { getBase64Size, compressImage } from '@/utils/image';

// ... 中间常量与 tabList / layouts 定义保持不变 ...

export function useAppearanceEditor() {
  const site = useSiteStore();
  const themeConfig = useThemeConfigStore();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const isMobileAdmin = useMediaQuery(theme.breakpoints.down('lg'));
  const [tab, setTab] = useState<AppearanceTab>('basic');
  const [saving, setSaving] = useState(false);

  // ... layout / font / cursor / click effect 相关 state 保持不变 ...

  // ===== 新增：打赏（reward）state =====
  const rewardCfg = (site.config.reward || {}) as Partial<RewardConfig>;
  const [reward, setReward] = useState<RewardConfig>({
    enabled: rewardCfg.enabled ?? false,
    title: rewardCfg.title ?? '',
    tip: rewardCfg.tip ?? '',
    alipayQr: rewardCfg.alipayQr ?? '',
    wechatQr: rewardCfg.wechatQr ?? '',
  });

  // ... 中间的 useEffect（layout/font/cursor/clickEffect/previewCursor/fontPreview/fetchPosts）保持不变 ...

  // basic
  const [siteName, setSiteName] = useState(site.config.siteName || 'StarBlog');
  // ... 其他 basic state 保持不变 ...
  const [policeBeian, setPoliceBeian] = useState(site.config.policeBeian || '');

  // ... hero / nav / about state 保持不变 ...

  // ===== 新增：reward 同步 effect =====
  useEffect(() => {
    const cfg = (site.config.reward || {}) as Partial<RewardConfig>;
    setReward({
      enabled: cfg.enabled ?? false,
      title: cfg.title ?? '',
      tip: cfg.tip ?? '',
      alipayQr: cfg.alipayQr ?? '',
      wechatQr: cfg.wechatQr ?? '',
    });
  }, [site.config.reward]);

  // ... 原有的大同步 useEffect（监听 site.config）中也需要补充 reward 同步 =====
  // 在原来那个 useEffect 里，找到 setPoliceBeian 之后，添加：
  /*
    const rewardCfgSync = (c.reward || {}) as Partial<RewardConfig>;
    setReward({
      enabled: rewardCfgSync.enabled ?? false,
      title: rewardCfgSync.title ?? '',
      tip: rewardCfgSync.tip ?? '',
      alipayQr: rewardCfgSync.alipayQr ?? '',
      wechatQr: rewardCfgSync.wechatQr ?? '',
    });
  */

  // ... activeColors 保持不变 ...

  // ===== 新增：isDirty 中补充 reward 比较 =====
  const isDirty = useMemo(() => {
    // ... 原有所有比较逻辑保持不变 ...

    // 在 spacing 比较之后、return false 之前添加：
    const currentReward = (site.config.reward || {}) as Partial<RewardConfig>;
    if (reward.enabled !== (currentReward.enabled ?? false)) return true;
    if (reward.title !== (currentReward.title ?? '')) return true;
    if (reward.tip !== (currentReward.tip ?? '')) return true;
    if (reward.alipayQr !== (currentReward.alipayQr ?? '')) return true;
    if (reward.wechatQr !== (currentReward.wechatQr ?? '')) return true;

    return false;
  }, [
    // ... 原有所有依赖项保持不变 ...
    // 在末尾追加：
    reward,
    site.config.reward,
  ]);

  // ... resetToPreset / handleColorChange / handleImageUpload / updateSpacing / resetSpacing 保持不变 ...

  const applyAll = async () => {
    setSaving(true);

    // ... heroConfig / aboutConfig / navConfig 构建保持不变 ...

    const siteConfig = {
      // ... 原有所有字段保持不变 ...
      clickEffect: {
        enabled: clickEffectEnabled,
        type: clickEffectType,
        colorMode: clickEffectColorMode,
        customColor: clickEffectCustomColor,
        textList: clickEffectTextList
          .split(/\n/)
          .map((t) => t.trim())
          .filter(Boolean),
        intensity: clickEffectIntensity,
      },
      // ===== 新增：将 reward 写入保存配置 =====
      reward,
    };

    const siteOk = await site.saveConfig(siteConfig);

    if (siteOk) {
      // ... 原有 setState 和重新同步逻辑保持不变 ...
      // 在重新同步部分（setClickEffectIntensity 之后）补充：
      /*
        const savedReward = (sc.reward || {}) as Partial<RewardConfig>;
        setReward({
          enabled: savedReward.enabled ?? false,
          title: savedReward.title ?? '',
          tip: savedReward.tip ?? '',
          alipayQr: savedReward.alipayQr ?? '',
          wechatQr: savedReward.wechatQr ?? '',
        });
      */
    }

    setSaving(false);
    // ... 后续 snackbar 提示保持不变 ...
  };

  // ... 字体 / 鼠标相关 handler 全部保持不变 ...

  return {
    // ... 原有所有返回值保持不变 ...

    // ===== 新增：导出 reward 相关 =====
    reward,
    setReward,

    // 杂项
    isDirty,
    handleImageUpload,
    applyAll,
    // 常量
    MAX_HERO_IMAGE_SIZE,
    MAX_ICON_SIZE,
    MAX_SHARE_IMAGE_SIZE,
    MAX_BACKGROUND_SIZE,
    DEFAULT_FONT_FALLBACK,
  };
}

export type AppearanceEditor = ReturnType<typeof useAppearanceEditor>;
