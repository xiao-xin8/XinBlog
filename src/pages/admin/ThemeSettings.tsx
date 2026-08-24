import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  Grid,
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

type DisplayTheme = {
  id: string;
  name: string;
  description?: string;
  author?: string;
  previewImage?: string;
  isActive: boolean;
  builtin?: boolean;
};

type ThemeTab = 'post-card' | 'post-detail' | 'scene' | 'hero' | 'nav';

const tabList: { value: ThemeTab; label: string }[] = [
  { value: 'post-card', label: '文章卡片' },
  { value: 'post-detail', label: '文章详情' },
  { value: 'scene', label: '场景主题' },
  { value: 'hero', label: '英雄区主题' },
  { value: 'nav', label: '导航设置' },
];

function builtinThemeById(id: string): ThemePackage | undefined {
  return BUILTIN_THEMES.find((t) => t.id === id);
}


function resolveActiveBuiltinId(variant: string): string {
  if (variant === 'default') return '';
  const t = BUILTIN_THEMES.find((b) => (b.components?.postCard?.variant || '') === variant);
  return t?.id || '';
}




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

      
      
      const optimistic = normalizeSiteConfig({ ...site.config, cardTheme: nextCardTheme });
      site.setConfig({ cardTheme: optimistic.cardTheme ?? defaultCardTheme });
      setCachedSiteConfig(optimistic);

      
      
      const ok = await site.saveConfig({ cardTheme: nextCardTheme });
      if (!ok) throw new Error('主题设置保存失败');

      
      
      
      
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

      
      const newActiveId = resolveActiveBuiltinId(variant);
      setActiveThemeId(newActiveId);
      setPendingActiveThemeId(newActiveId);
      setPendingResetToDefault(false);
      
      
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
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4} sx={{ display: 'flex' }}>
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

            </Grid>

            {displayThemes.map((t) => (
              <Grid item xs={12} sm={6} md={4} key={t.id} sx={{ display: 'flex' }}>
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

              </Grid>

            ))}
          </Grid>

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
              onWheel={(e) => {
                const el = e.currentTarget;
                if (el.scrollWidth <= el.clientWidth) return;
                e.preventDefault();
                el.scrollLeft += e.deltaY;
              }}
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
            {tab === 'hero' && renderHeroPanel()}
            {tab === 'nav' && renderNavPanel()}
          </Box>

        </Fade>

      </Box>

    </Fade>

  );
}
