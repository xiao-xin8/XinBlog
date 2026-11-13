import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  alpha,
  Fade,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { GridView, ViewList, AutoStories } from '@mui/icons-material';
import { ColorPicker } from '@/components/Common/ColorPicker';
import { useSnackbar } from 'notistack';
import { useSiteStore, setCachedSiteConfig, normalizeSiteConfig } from '@/stores/siteStore';
import { useUIStore } from '@/stores/uiStore';
import { fetchPosts } from '@/api/posts';
import { apiPost, apiPatch } from '@/api/client';
import { getPostCardRenderer } from '@/utils/themeRenderers';
import { defaultCardTheme, mergeCardTheme, normalizeCardTheme } from '@/utils/postCardTheme';
import { PostListGrid } from '@/components/Post/PostListGrid';
import { PostListHorizontal } from '@/components/Post/PostListHorizontal';
import { PostListMagazine } from '@/components/Post/PostListMagazine';
import { Loading } from '@/components/Common/Loading';
import { FloatingSaveButton } from '@/components/Common/FloatingSaveButton';
import type { Post, PostCardThemeConfig, ThemeParamSchema, ThemePackage } from '@/types';
import type { PostLayoutMode } from '@/stores/uiStore';
import { BUILTIN_THEMES } from '@/themes/builtin';
import { SceneThemePanel } from './scene/SceneThemePanel';
import { HeroThemePanel } from './hero/HeroThemePanel';
import { NavSettings } from './NavSettings';
import { PostDetailThemePanel } from './postDetail/PostDetailThemePanel';
import { ChatBubbleThemePanel } from './chatBubble/ChatBubbleThemePanel';

type DisplayTheme = {
  id: string;
  name: string;
  description?: string;
  author?: string;
  previewImage?: string;
  isActive: boolean;
  builtin?: boolean;
};

type ThemeTab = 'post-card' | 'post-detail' | 'scene' | 'hero' | 'nav' | 'chat-bubble';

const tabList: { value: ThemeTab; label: string }[] = [
  { value: 'post-card', label: '文章卡片' },
  { value: 'post-detail', label: '文章详情' },
  { value: 'scene', label: '场景主题' },
  { value: 'chat-bubble', label: '聊天气泡' },
  { value: 'hero', label: '英雄区主题' },
  { value: 'nav', label: '导航设置' },
];

function builtinThemeById(id: string): ThemePackage | undefined {
  return BUILTIN_THEMES.find((t) => t.id === id);
}

// 根据当前生效的卡片 variant，反查出对应内置主题的 id（'' 表示默认主题）
function resolveActiveBuiltinId(variant: string): string {
  if (variant === 'default') return '';
  const t = BUILTIN_THEMES.find((b) => (b.components?.postCard?.variant || '') === variant);
  return t?.id || '';
}

// 用已保存的卡片配置（site.config.cardTheme）覆盖内置主题包的默认参数，
// 使设置面板在重新进入页面时显示真实的已保存参数，而不是回退到出厂默认值。
// 仅当传入 saved 时才覆盖；选中"非当前已保存"主题时用 undefined 保持出厂默认。
function buildEditingThemeFromSaved(id: string, saved?: PostCardThemeConfig): ThemePackage | null {
  const pkg = builtinThemeById(id);
  if (!pkg) return null;
  const pkgCard = pkg.components?.postCard;
  if (!pkgCard) return pkg;
  const mergedCard = saved ? { ...pkgCard, ...mergeCardTheme(saved) } : pkgCard;
  return {
    ...pkg,
    components: {
      ...pkg.components,
      postCard: mergedCard,
    },
  };
}

// 主题卡片缩略预览：直接画一段 SVG 小卡片，引用当前外观主色（边框画报显示描边）
const ThemePreviewThumb = ({ bordered }: { bordered?: boolean }) => {
  const theme = useTheme();
  const accent = theme.palette.primary.main;
  const paper = theme.palette.background.paper;
  const line = alpha(theme.palette.text.primary, 0.18);
  const line2 = alpha(theme.palette.text.primary, 0.1);
  return (
    <svg viewBox="0 0 80 60" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden>
      <rect
        x="2"
        y="2"
        width="76"
        height="56"
        rx="8"
        fill={paper}
        stroke={bordered ? accent : alpha(theme.palette.text.primary, 0.12)}
        strokeWidth={bordered ? 3 : 1}
      />
      <path d="M2 11 Q2 2 11 2 H69 Q78 2 78 11 V26 H2 Z" fill={accent} opacity={bordered ? 0.16 : 0.4} />
      <rect x="9" y="36" width="48" height="4" rx="2" fill={line} />
      <rect x="9" y="46" width="32" height="4" rx="2" fill={line2} />
    </svg>
  );
};

const layouts: { id: PostLayoutMode; name: string; icon: React.ReactNode }[] = [
  { id: 'grid', name: '网格卡片', icon: <GridView sx={{ fontSize: 20 }} /> },
  { id: 'list', name: '横向列表', icon: <ViewList sx={{ fontSize: 20 }} /> },
  { id: 'magazine', name: '杂志布局', icon: <AutoStories sx={{ fontSize: 20 }} /> },
];

export function AdminThemeSettings() {
  const site = useSiteStore();
  const ui = useUIStore();
  const theme = useTheme();
  const isMobileAdmin = useMediaQuery(theme.breakpoints.down('lg'));
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState<ThemeTab>('post-card');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const tabContainerRef = useRef<HTMLDivElement>(null);
  const tabStripRef = useRef<HTMLDivElement>(null);
  const themeRowRef = useRef<HTMLDivElement>(null);
  // 主题列表改为横向滚动：鼠标悬停时接管垂直滚轮，把它映射成左右滚动，
  // 并通过 requestAnimationFrame 插值（lerp）实现平滑滚动，避免逐帧赋值导致的抖动。
  const wheelTargetRef = useRef(0);
  const rafRef = useRef(0);
  const scrollRowTo = (target: number) => {
    const el = themeRowRef.current;
    if (!el) return;
    const maxLeft = el.scrollWidth - el.clientWidth;
    wheelTargetRef.current = Math.max(0, Math.min(maxLeft, target));
    if (rafRef.current) return; // 已有动画在跑，仅更新目标值
    const step = () => {
      const row = themeRowRef.current;
      if (!row) {
        rafRef.current = 0;
        return;
      }
      const diff = wheelTargetRef.current - row.scrollLeft;
      if (Math.abs(diff) < 0.5) {
        row.scrollLeft = wheelTargetRef.current;
        rafRef.current = 0;
        return;
      }
      row.scrollLeft += diff * 0.18; // 插值因子：越大越跟手，越小越平滑
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };
  // 注意：不能用 React 的 onWheel（被动监听），那样 preventDefault 无效，页面仍会跟着滚动。
  // 也不能只用 useEffect 一次性绑定——主题行是加载后才渲染的，得用回调 ref，
  // 只要 DOM 节点一挂载就绑定原生非被动监听，真正接管滚轮（主题行横滚，页面不动）。
  const setThemeRowRef = useCallback((node: HTMLDivElement | null) => {
    themeRowRef.current = node;
    if (!node) return undefined;
    const onWheel = (e: WheelEvent) => {
      if (node.scrollWidth <= node.clientWidth + 1) return; // 无可横滚内容时不接管
      e.preventDefault();
      scrollRowTo(node.scrollLeft + e.deltaX + e.deltaY);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);
  // 卸载时取消动画帧
  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
    },
    []
  );
  // tabs 横向滚动同样用回调 ref 绑定原生非被动监听，防止页面跟着滚动
  const setTabStripRef = useCallback((node: HTMLDivElement | null) => {
    tabStripRef.current = node;
    if (!node) return undefined;
    const onWheel = (e: WheelEvent) => {
      if (node.scrollWidth <= node.clientWidth) return;
      e.preventDefault();
      node.scrollLeft += e.deltaY;
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);
  const [tabsCompact, setTabsCompact] = useState(false);

  useEffect(() => {
    const el = tabContainerRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      const minWidth = tabList.length * 88;
      setTabsCompact(width > 0 && width < minWidth);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [activeThemeId, setActiveThemeId] = useState<string>('');
  const [pendingActiveThemeId, setPendingActiveThemeId] = useState<string>('');
  const [pendingResetToDefault, setPendingResetToDefault] = useState(false);
  const [editingThemeId, setEditingThemeId] = useState<string>('');
  const [editingTheme, setEditingTheme] = useState<ThemePackage | null>(null);
  const [originalEditingTheme, setOriginalEditingTheme] = useState<ThemePackage | null>(null);

  const [previewPosts, setPreviewPosts] = useState<Post[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLayout, setPreviewLayout] = useState<PostLayoutMode>(() => {
    const layout = site.config.postLayout || ui.postLayout;
    if (layout && ['grid', 'list', 'magazine'].includes(layout)) return layout as PostLayoutMode;
    return 'grid';
  });

  useEffect(() => {
    const layout = site.config.postLayout || ui.postLayout;
    if (layout && ['grid', 'list', 'magazine'].includes(layout)) {
      setPreviewLayout(layout as PostLayoutMode);
    }
  }, [site.config.postLayout, ui.postLayout]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      await site.loadConfig();
      await ui.loadConfig();
      if (!mounted) return;
      const variant = site.config.cardTheme?.variant || 'default';
      const activeId = resolveActiveBuiltinId(variant);
      setActiveThemeId(activeId);
      setPendingActiveThemeId(activeId);
      setPendingResetToDefault(false);
      setEditingThemeId(activeId);
      if (activeId) {
        // 关键：合并已保存的 site.config.cardTheme（用户自定义参数），
        // 否则重新进入页面时面板会回退到出厂默认，与云端/主页不一致。
        const pkg = buildEditingThemeFromSaved(activeId, site.config.cardTheme);
        if (pkg) {
          setEditingTheme(pkg);
          setOriginalEditingTheme(JSON.parse(JSON.stringify(pkg)));
        }
      } else {
        setEditingTheme(null);
        setOriginalEditingTheme(null);
      }
      if (mounted) setLoading(false);
    };
    load();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleSelectEditTheme = (id: string) => {
    setEditingThemeId(id);
    // 仅当选中的正是"当前已保存激活"的主题时，才回填已保存参数；
    // 选中其它未保存的主题则保持出厂默认（此时云端没有它的参数）。
    const savedVariant = site.config.cardTheme?.variant || 'default';
    const savedId = resolveActiveBuiltinId(savedVariant);
    const useSaved = id === savedId ? site.config.cardTheme : undefined;
    const pkg = buildEditingThemeFromSaved(id, useSaved);
    if (pkg) {
      setEditingTheme(pkg);
      setOriginalEditingTheme(JSON.parse(JSON.stringify(pkg)));
    } else {
      setEditingTheme(null);
      setOriginalEditingTheme(null);
    }
  };

  const isEditingThemeActive = useMemo(() => {
    if (!editingThemeId || !pendingActiveThemeId) return false;
    return editingThemeId === pendingActiveThemeId;
  }, [editingThemeId, pendingActiveThemeId]);

  const editingCardTheme = useMemo(() => {
    return normalizeCardTheme(editingTheme?.components?.postCard || defaultCardTheme);
  }, [editingTheme]);

  const activeRenderer = useMemo(() => getPostCardRenderer(editingCardTheme.variant), [editingCardTheme.variant]);
  const activeSchema = useMemo<ThemeParamSchema[]>(() => {
    return editingCardTheme.schema || activeRenderer?.schema || [];
  }, [editingCardTheme.schema, activeRenderer]);

  // 主题列表完全来自本地内置主题，不再读取云端 themes 表（取消对云端主题表的依赖）
  const displayThemes = useMemo<DisplayTheme[]>(() => {
    const variant = site.config.cardTheme?.variant || 'default';
    return BUILTIN_THEMES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      author: t.author,
      previewImage: '',
      isActive: (t.components?.postCard?.variant || '') === variant,
      builtin: true,
    }));
  }, [site.config.cardTheme?.variant]);

  const updateEditingCardTheme = (patch: Partial<PostCardThemeConfig>) => {
    setEditingTheme((prev) => {
      if (!prev) return prev;
      const current: PostCardThemeConfig = prev.components?.postCard || { ...defaultCardTheme };
      const nextParams = { ...(current.params || {}), ...patch };
      const nextCard: PostCardThemeConfig = {
        ...current,
        params: nextParams,
      };
      return {
        ...prev,
        components: {
          ...prev.components,
          postCard: nextCard,
        },
      };
    });
  };

  const handleResetCardTheme = () => {
    if (!editingTheme) return;
    const renderer = getPostCardRenderer(editingCardTheme.variant);
    const defaults: PostCardThemeConfig = renderer
      ? { ...(renderer.defaultParams as unknown as PostCardThemeConfig), variant: renderer.aliases?.[0] || renderer.id }
      : { ...defaultCardTheme };
    updateEditingCardTheme(defaults);
    enqueueSnackbar('已恢复默认卡片样式，点击保存后生效', { variant: 'info' });
  };

  const isDirty = useMemo(() => {
    if (!editingTheme || !originalEditingTheme) return false;
    return JSON.stringify(editingTheme) !== JSON.stringify(originalEditingTheme);
  }, [editingTheme, originalEditingTheme]);

  const handleApplyTheme = (id: string) => {
    setPendingActiveThemeId(id);
    setPendingResetToDefault(false);
    handleSelectEditTheme(id);
    enqueueSnackbar('已选择该主题，点击保存后生效', { variant: 'info' });
  };

  const handleResetToDefault = () => {
    setPendingActiveThemeId('');
    setPendingResetToDefault(true);
    setEditingThemeId('');
    setEditingTheme(null);
    setOriginalEditingTheme(null);
    enqueueSnackbar('已选择默认主题，点击保存后生效', { variant: 'info' });
  };

  const handleSaveTheme = async () => {
    setSaving(true);
    try {
      const nextCardTheme: PostCardThemeConfig = pendingResetToDefault
        ? { ...defaultCardTheme }
        : (editingTheme?.components?.postCard ?? site.config.cardTheme ?? defaultCardTheme);

      // 1) 实时写本地缓存 + 内存（乐观更新）：立即生效、不被 CDN/云端旧数据回源覆盖，
      //    保证"本地缓存实时更新"。参考评论/外观等页面"云端更新、顺带本地更新"的逻辑。
      const optimistic = normalizeSiteConfig({ ...site.config, cardTheme: nextCardTheme });
      site.setConfig({ cardTheme: optimistic.cardTheme ?? defaultCardTheme });
      setCachedSiteConfig(optimistic);

      // 2) 再持久化到云端（与其他设置共用 site.saveConfig → /api/v1/admin/settings），
      //    云端与本地保持一致。
      const ok = await site.saveConfig({ cardTheme: nextCardTheme });
      if (!ok) throw new Error('主题设置保存失败');

      // 3) 同步维护后端 active_theme：GET /api/v1/site 依据它决定是否返回已保存的 cardTheme，
      //    否则刷新页面后 cardTheme 会被强制回退成默认（之前“刷新全部还原”的根因）。
      //    前端内置主题直接把 postCard 传给 apply 接口，不依赖已被清除的 themes 表。
      //    对齐评论管理“云端更新、顺带本地更新”的逻辑。
      const variant = nextCardTheme.variant || 'default';
      if (pendingResetToDefault || variant === 'default') {
        const clearRes = await apiPost<null>('/api/v1/admin/themes/clear-active', {});
        if (clearRes.code !== 0) throw new Error(clearRes.msg || '重置主题失败');
      } else {
        const activeId = resolveActiveBuiltinId(variant) || variant;
        const applyRes = await apiPatch<null>(`/api/v1/admin/themes/${activeId}/apply`, {
          postCard: nextCardTheme,
        });
        if (applyRes.code !== 0) throw new Error(applyRes.msg || '应用主题失败');
      }

      // 4) 同步后台 UI 状态
      const newActiveId = resolveActiveBuiltinId(variant);
      setActiveThemeId(newActiveId);
      setPendingActiveThemeId(newActiveId);
      setPendingResetToDefault(false);
      // 关键：保存成功后把"原始快照"对齐到当前编辑内容，
      // 否则 isDirty 一直为 true，悬浮保存按钮不会隐藏。
      setOriginalEditingTheme(editingTheme ? JSON.parse(JSON.stringify(editingTheme)) : null);
      enqueueSnackbar('主题设置已保存', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : '保存失败', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const renderCardPreview = () => {
    if (previewLoading) return <Loading text="加载预览中..." />;
    if (previewPosts.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
          <Typography>暂无文章可供预览</Typography>
        </Box>
      );
    }
    return (
      <Box sx={{ pointerEvents: 'none', maxWidth: '100%', overflow: 'hidden' }}>
        {previewLayout === 'list' && <PostListHorizontal posts={previewPosts.slice(0, 2)} theme={editingCardTheme} />}
        {previewLayout === 'magazine' && <PostListMagazine posts={previewPosts.slice(0, 3)} theme={editingCardTheme} />}
        {previewLayout === 'grid' && <PostListGrid posts={previewPosts} theme={editingCardTheme} />}
      </Box>
    );
  };

  const renderPostCardPanel = () => (
    <Stack spacing={3}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 3 },
          borderRadius: 1,
          boxShadow: (t) =>
            t.palette.mode === 'light'
              ? `0 4px 20px ${alpha(t.palette.primary.main, 0.08)}`
              : `0 4px 20px ${alpha(t.palette.common.black, 0.25)}`,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          所有主题
        </Typography>
        {displayThemes.length === 0 ? (
          <Box>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              暂无可用主题。
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Refresh />}
              onClick={handleResetToDefault}
              sx={{ borderRadius: 1 }}
            >
              恢复默认主题
            </Button>
          </Box>
        ) : (
          <Box
            ref={setThemeRowRef}
            sx={{
              display: 'flex',
              flexWrap: 'nowrap',
              overflowX: 'auto',
              overflowY: 'hidden',
              scrollBehavior: 'auto', // 关闭全局 smooth，交由上方 rAF lerp 平滑
              gap: 2,
              pb: 1,
              pt: 0.5,
              scrollbarWidth: 'thin',
              '&::-webkit-scrollbar': { height: 8 },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'action.disabled', borderRadius: 2 },
              '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
            }}
          >
            <Box sx={{ flex: '0 0 auto', width: { xs: '72%', sm: 290, md: 330 }, display: 'flex' }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 1,
                  cursor: 'default',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  border: '2px solid',
                  borderColor: pendingActiveThemeId === '' ? 'primary.main' : 'transparent',
                  bgcolor: (theme) =>
                    pendingActiveThemeId === ''
                      ? alpha(theme.palette.primary.main, 0.06)
                      : alpha(theme.palette.primary.main, 0.02),
                  transition: 'all 0.2s ease',
                }}
              >
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flex: 1 }}>
                  <Box
                    sx={{
                      width: 80,
                      height: 60,
                      borderRadius: 1,
                      overflow: 'hidden',
                      bgcolor: 'action.hover',
                      flexShrink: 0,
                    }}
                  >
                    <ThemePreviewThumb />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" fontWeight={700} noWrap>
                      默认主题
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>
                      恢复为系统内置默认卡片样式
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ mt: 1.5 }}>
                  <Button
                    variant={pendingActiveThemeId === '' ? 'outlined' : 'contained'}
                    size="small"
                    fullWidth
                    disabled={pendingActiveThemeId === ''}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResetToDefault();
                    }}
                    sx={{ borderRadius: 1 }}
                  >
                    {pendingActiveThemeId === '' ? '已选中' : '恢复默认'}
                  </Button>
                </Box>
              </Paper>
            </Box>
            {displayThemes.map((t) => (
              <Box key={t.id} sx={{ flex: '0 0 auto', width: { xs: '72%', sm: 290, md: 330 }, display: 'flex' }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 1,
                    cursor: 'default',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    border: '2px solid',
                    borderColor: pendingActiveThemeId === t.id ? 'primary.main' : 'transparent',
                    bgcolor: (theme) =>
                      pendingActiveThemeId === t.id
                        ? alpha(theme.palette.primary.main, 0.06)
                        : alpha(theme.palette.primary.main, 0.02),
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flex: 1 }}>
                    <Box
                      sx={{
                        width: 80,
                        height: 60,
                        borderRadius: 1,
                        overflow: 'hidden',
                        bgcolor: 'action.hover',
                        flexShrink: 0,
                      }}
                    >
                      <ThemePreviewThumb bordered={builtinThemeById(t.id)?.components?.postCard?.variant === 'border-image'} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" fontWeight={700} noWrap>
                        {t.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ wordBreak: 'break-word', whiteSpace: 'normal' }}
                      >
                        {t.description || t.author || '主题包'}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
                    <Button
                      variant={pendingActiveThemeId === t.id ? 'outlined' : 'contained'}
                      size="small"
                      fullWidth
                      disabled={pendingActiveThemeId === t.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApplyTheme(t.id);
                      }}
                      sx={{ borderRadius: 1 }}
                    >
                      {pendingActiveThemeId === t.id ? '已选中' : '应用'}
                    </Button>
                    {pendingActiveThemeId === t.id && (
                      <Button
                        variant="outlined"
                        size="small"
                        fullWidth
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResetToDefault();
                        }}
                        sx={{ borderRadius: 1 }}
                      >
                        恢复默认
                      </Button>
                    )}
                  </Box>
                </Paper>
              </Box>
            ))}
          </Box>
        )}
      </Paper>

      {editingTheme && isEditingThemeActive && (
        <Fade in timeout={400} key={editingThemeId || 'none'}>
          <Box>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, sm: 3 },
                borderRadius: 1,
                boxShadow: (t) =>
                  t.palette.mode === 'light'
                    ? `0 4px 20px ${alpha(t.palette.primary.main, 0.08)}`
                    : `0 4px 20px ${alpha(t.palette.common.black, 0.25)}`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  编辑「{editingTheme.name}」{isEditingThemeActive && (
                    <Box component="span" sx={{ ml: 1, px: 1, py: 0.25, borderRadius: 1, bgcolor: (t) => alpha(t.palette.primary.main, 0.1), color: 'primary.main', typography: 'caption', fontWeight: 600, verticalAlign: 'middle' }}>
                      正在使用
                    </Box>
                  )}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Refresh />}
                  onClick={handleResetCardTheme}
                  sx={{ borderRadius: 1, flexShrink: 0 }}
                >
                  恢复默认
                </Button>
              </Box>
              <Stack spacing={3}>
                {activeSchema.length === 0 ? (
                  <Typography color="text.secondary">该主题无可调参数。</Typography>
                ) : (
                  activeSchema.map((item) => {
                    const value = editingCardTheme[item.key as keyof PostCardThemeConfig];
                    if (item.type === 'number') {
                      const numeric = typeof value === 'number' ? value : item.min ?? 0;
                      return (
                        <Box key={item.key}>
                          <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                            {item.label} {numeric}px
                          </Typography>
                          <Slider
                            value={numeric}
                            onChange={(_, v) => updateEditingCardTheme({ [item.key]: v as number } as Partial<PostCardThemeConfig>)}
                            min={item.min ?? 0}
                            max={item.max ?? 100}
                            step={item.step ?? 1}
                            valueLabelDisplay="auto"
                          />
                        </Box>
                      );
                    }
                    if (item.type === 'boolean') {
                      return (
                        <FormControlLabel
                          key={item.key}
                          control={
                            <Switch
                              checked={!!value}
                              onChange={(e) => updateEditingCardTheme({ [item.key]: e.target.checked } as Partial<PostCardThemeConfig>)}
                            />
                          }
                          label={item.label}
                        />
                      );
                    }
                    if (item.type === 'select') {
                      return (
                        <Box key={item.key}>
                          <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                            {item.label}
                          </Typography>
                          <ToggleButtonGroup
                            value={String(value ?? '')}
                            exclusive
                            onChange={(_, v) => v !== null && updateEditingCardTheme({ [item.key]: v } as Partial<PostCardThemeConfig>)}
                            size="small"
                            sx={{
                              bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                              borderRadius: (t) => t.shape.borderRadius * 1.5,
                              p: 0.5,
                              '& .MuiToggleButtonGroup-grouped': {
                                border: 'none',
                                borderRadius: (t) => t.shape.borderRadius * 1.5,
                                px: 2.5,
                                py: 0.6,
                                typography: 'body2',
                                fontWeight: 600,
                                color: 'text.secondary',
                                '&.Mui-selected': {
                                  bgcolor: 'background.paper',
                                  color: 'primary.main',
                                  boxShadow: (t) => `0 2px 10px ${alpha(t.palette.common.black, 0.08)}`,
                                },
                              },
                            }}
                          >
                            {(item.options || []).map((opt) => (
                              <ToggleButton key={opt.value} value={opt.value}>
                                {opt.label}
                              </ToggleButton>
                            ))}
                          </ToggleButtonGroup>
                        </Box>
                      );
                    }
                    if (item.type === 'color') {
                      return (
                        <Box key={item.key}>
                          <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                            {item.label}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                            <ColorPicker
                              value={String(value || '#000000')}
                              onChange={(v) => updateEditingCardTheme({ [item.key]: v } as Partial<PostCardThemeConfig>)}
                            />
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => updateEditingCardTheme({ [item.key]: '' } as Partial<PostCardThemeConfig>)}
                              sx={{ borderRadius: 1 }}
                            >
                              使用主题色
                            </Button>
                          </Box>
                        </Box>
                      );
                    }
                    return null;
                  })
                )}
              </Stack>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, sm: 3 },
                borderRadius: 1,
                boxShadow: (t) =>
                  t.palette.mode === 'light'
                    ? `0 4px 20px ${alpha(t.palette.primary.main, 0.08)}`
                    : `0 4px 20px ${alpha(t.palette.common.black, 0.25)}`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  实时预览
                </Typography>
                <ToggleButtonGroup
                  value={previewLayout}
                  exclusive
                  onChange={(_, value) => value && setPreviewLayout(value as PostLayoutMode)}
                  size="small"
                  sx={{
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                    borderRadius: (t) => t.shape.borderRadius * 1.5,
                    p: 0.5,
                    '& .MuiToggleButtonGroup-grouped': {
                      border: 'none',
                      borderRadius: (t) => t.shape.borderRadius * 1.5,
                      px: 2,
                      py: 0.5,
                      typography: 'body2',
                      fontWeight: 600,
                      color: 'text.secondary',
                      '&.Mui-selected': {
                        bgcolor: 'background.paper',
                        color: 'primary.main',
                        boxShadow: (t) => `0 2px 10px ${alpha(t.palette.common.black, 0.08)}`,
                      },
                    },
                  }}
                >
                  {layouts.map((layout) => (
                    <ToggleButton key={layout.id} value={layout.id}>
                      {layout.icon}
                      <Box component="span" sx={{ ml: 0.75 }}>
                        {layout.name}
                      </Box>
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
              {renderCardPreview()}
            </Paper>
          </Box>
        </Fade>
      )}

      <FloatingSaveButton
        show={isDirty || pendingActiveThemeId !== activeThemeId || pendingResetToDefault}
        saving={saving}
        onClick={handleSaveTheme}
        label="保存主题"
      />
    </Stack>
  );

  const renderPostDetailPanel = () => <PostDetailThemePanel />;

  const renderScenePanel = () => <SceneThemePanel />;

  const renderChatBubblePanel = () => <ChatBubbleThemePanel />;

  const renderHeroPanel = () => <HeroThemePanel />;

  const renderNavPanel = () => <NavSettings />;

  if (loading) return <Loading text="加载主题配置中..." />;

  return (
    <Fade in timeout={400}>
      <Box>
        <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', mb: 1, gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
              主题设置
            </Typography>
            <Typography variant="body2" color="text.secondary">
              管理站点主题，自定义文章卡片、场景特效、英雄区布局与顶部导航等视觉风格。
            </Typography>
          </Box>
        </Box>

        <Box ref={tabContainerRef} sx={{ mt: 3, mb: 3 }}>
          {isMobileAdmin || tabsCompact ? (
            <FormControl size="small" sx={{ mb: 3, minWidth: 140, maxWidth: '100%' }}>
              <Select
                value={tab}
                onChange={(e) => setTab(e.target.value as ThemeTab)}
                sx={{
                  borderRadius: (t) => t.shape.borderRadius * 1.5,
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '& .MuiSelect-select': {
                    fontWeight: 600,
                    color: 'primary.main',
                    py: 1,
                    px: 2,
                  },
                }}
              >
                {tabList.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {item.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <Box
              ref={setTabStripRef}
              sx={{
                maxWidth: '100%',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                pb: 0.5,
                '&::-webkit-scrollbar': { display: 'none' },
              }}
            >
              <Box
                sx={{
                  position: 'relative',
                  display: 'inline-flex',
                  minWidth: 'max-content',
                  p: 0.5,
                  borderRadius: (t) => t.shape.borderRadius * 1.5,
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    top: 4,
                    bottom: 4,
                    left: 4,
                    width: `calc((100% - 8px) / ${tabList.length})`,
                    bgcolor: 'background.paper',
                    borderRadius: (t) => t.shape.borderRadius * 1.5,
                    boxShadow: (t) => `0 2px 10px ${alpha(t.palette.common.black, 0.08)}`,
                    transition: (t) =>
                      t.transitions.create('transform', {
                        easing: t.transitions.easing.easeInOut,
                        duration: t.transitions.duration.short,
                      }),
                    transform: `translateX(${tabList.findIndex((t) => t.value === tab) * 100}%)`,
                  }}
                />
                {tabList.map((item) => {
                  const active = tab === item.value;
                  return (
                    <Button
                      key={item.value}
                      onClick={() => setTab(item.value)}
                      sx={{
                        position: 'relative',
                        zIndex: 1,
                        px: { xs: 2, sm: 3 },
                        py: 0.8,
                        borderRadius: (t) => t.shape.borderRadius * 1.5,
                        color: active ? 'primary.main' : 'text.secondary',
                        bgcolor: 'transparent',
                        fontWeight: 600,
                        textTransform: 'none',
                        whiteSpace: 'nowrap',
                        boxShadow: 'none',
                        '&:hover': { bgcolor: 'transparent' },
                      }}
                    >
                      {item.label}
                    </Button>
                  );
                })}
              </Box>
            </Box>
          )}
        </Box>

        <Fade in timeout={300} key={tab}>
          <Box>
            {tab === 'post-card' && renderPostCardPanel()}
            {tab === 'post-detail' && renderPostDetailPanel()}
            {tab === 'scene' && renderScenePanel()}
            {tab === 'chat-bubble' && renderChatBubblePanel()}
            {tab === 'hero' && renderHeroPanel()}
            {tab === 'nav' && renderNavPanel()}
          </Box>
        </Fade>
      </Box>
    </Fade>
  );
}
