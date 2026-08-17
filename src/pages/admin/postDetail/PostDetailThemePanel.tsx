import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Fade, Grid, Paper, Stack, Typography, alpha } from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useSiteStore, setCachedSiteConfig, normalizeSiteConfig } from '@/stores/siteStore';
import { fetchPosts } from '@/api/posts';
import { FloatingSaveButton } from '@/components/Common/FloatingSaveButton';
import { Loading } from '@/components/Common/Loading';
import type { Post, PostDetailThemeConfig, ThemePackage } from '@/types';
import { BUILTIN_POST_DETAIL_THEMES } from '@/themes/postDetail/builtin';
import { PostDetailThemeCard } from './PostDetailThemeCard';
import { PostDetailThemeParamEditor } from './PostDetailThemeParamEditor';
import { PostDetailThemePreview } from './PostDetailThemePreview';

const DEFAULT_POST_DETAIL_THEME: PostDetailThemeConfig = { variant: 'default' };

function getThemeById(id: string): ThemePackage | undefined {
  return BUILTIN_POST_DETAIL_THEMES.find((t) => t.id === id);
}

function resolveActiveId(variant: string): string {
  if (variant === 'default') return '';
  const t = BUILTIN_POST_DETAIL_THEMES.find(
    (b) => (b.components?.postDetail?.variant || '') === variant
  );
  return t?.id || '';
}

function buildEditingTheme(id: string, saved?: PostDetailThemeConfig): ThemePackage | null {
  const pkg = getThemeById(id);
  if (!pkg) return null;
  const pkgDetail = pkg.components?.postDetail;
  if (!pkgDetail) return pkg;
  const mergedDetail = saved ? { ...pkgDetail, ...saved } : pkgDetail;
  return {
    ...pkg,
    components: {
      ...pkg.components,
      postDetail: mergedDetail,
    },
  };
}

export function PostDetailThemePanel() {
  const site = useSiteStore();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeThemeId, setActiveThemeId] = useState<string>('');
  const [pendingActiveThemeId, setPendingActiveThemeId] = useState<string>('');
  const [editingThemeId, setEditingThemeId] = useState<string>('');
  const [editingTheme, setEditingTheme] = useState<ThemePackage | null>(null);
  const [originalEditingTheme, setOriginalEditingTheme] = useState<ThemePackage | null>(null);
  const [previewPosts, setPreviewPosts] = useState<Post[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      await site.loadConfig();
      if (!mounted) return;
      const saved = site.config.postDetailTheme || DEFAULT_POST_DETAIL_THEME;
      const activeId = resolveActiveId(saved.variant);
      setActiveThemeId(activeId);
      setPendingActiveThemeId(activeId);
      setEditingThemeId(activeId);
      if (activeId) {
        const pkg = buildEditingTheme(activeId, saved);
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
      setPreviewPosts(data.slice(0, 4));
      setPreviewLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSelectEditTheme = (id: string) => {
    setEditingThemeId(id);
    const savedVariant = site.config.postDetailTheme?.variant || 'default';
    const savedId = resolveActiveId(savedVariant);
    const useSaved = id === savedId ? site.config.postDetailTheme : undefined;
    const pkg = buildEditingTheme(id, useSaved);
    if (pkg) {
      setEditingTheme(pkg);
      setOriginalEditingTheme(JSON.parse(JSON.stringify(pkg)));
    } else {
      setEditingTheme(null);
      setOriginalEditingTheme(null);
    }
  };

  const handleApplyTheme = (id: string) => {
    setPendingActiveThemeId(id);
    handleSelectEditTheme(id);
    enqueueSnackbar('已选择该主题，点击保存后生效', { variant: 'info' });
  };

  const handleResetToDefault = () => {
    setPendingActiveThemeId('');
    setEditingThemeId('');
    setEditingTheme(null);
    setOriginalEditingTheme(null);
    enqueueSnackbar('已选择默认主题，点击保存后生效', { variant: 'info' });
  };

  const editingDetailTheme = useMemo<PostDetailThemeConfig>(() => {
    return editingTheme?.components?.postDetail || DEFAULT_POST_DETAIL_THEME;
  }, [editingTheme]);

  const activeSchema = useMemo(() => {
    return editingDetailTheme.schema || [];
  }, [editingDetailTheme]);

  const updateEditingDetailTheme = (patch: Partial<PostDetailThemeConfig>) => {
    setEditingTheme((prev) => {
      if (!prev) return prev;
      const current: PostDetailThemeConfig = prev.components?.postDetail || { ...DEFAULT_POST_DETAIL_THEME };
      const nextParams = { ...(current.params || {}), ...(patch.params || {}) };
      const nextDetail: PostDetailThemeConfig = {
        ...current,
        ...patch,
        params: nextParams,
      };
      return {
        ...prev,
        components: {
          ...prev.components,
          postDetail: nextDetail,
        },
      };
    });
  };

  const isDirty = useMemo(() => {
    if (!editingTheme || !originalEditingTheme) return false;
    return JSON.stringify(editingTheme) !== JSON.stringify(originalEditingTheme);
  }, [editingTheme, originalEditingTheme]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const nextTheme: PostDetailThemeConfig =
        pendingActiveThemeId === ''
          ? { ...DEFAULT_POST_DETAIL_THEME }
          : (editingTheme?.components?.postDetail ?? site.config.postDetailTheme ?? DEFAULT_POST_DETAIL_THEME);

      const optimistic = normalizeSiteConfig({ ...site.config, postDetailTheme: nextTheme });
      site.setConfig({ postDetailTheme: optimistic.postDetailTheme ?? DEFAULT_POST_DETAIL_THEME });
      setCachedSiteConfig(optimistic);

      const ok = await site.saveConfig({ postDetailTheme: nextTheme });
      if (!ok) throw new Error('文章详情主题保存失败');

      const newActiveId = resolveActiveId(nextTheme.variant);
      setActiveThemeId(newActiveId);
      setPendingActiveThemeId(newActiveId);
      setOriginalEditingTheme(editingTheme ? JSON.parse(JSON.stringify(editingTheme)) : null);
      enqueueSnackbar('文章详情主题已保存', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : '保存失败', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading text="加载文章详情主题中..." />;

  return (
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
                bgcolor: (t) =>
                  pendingActiveThemeId === ''
                    ? alpha(t.palette.primary.main, 0.06)
                    : alpha(t.palette.primary.main, 0.02),
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
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '70%' }}>
                    <Box sx={{ height: 4, width: '80%', bgcolor: (t) => alpha(t.palette.primary.main, 0.5), borderRadius: 0.5 }} />
                    <Box sx={{ height: 3, width: '100%', bgcolor: (t) => alpha(t.palette.primary.main, 0.25), borderRadius: 0.5 }} />
                    <Box sx={{ height: 3, width: '75%', bgcolor: (t) => alpha(t.palette.primary.main, 0.25), borderRadius: 0.5 }} />
                  </Box>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" fontWeight={700} noWrap>
                    默认主题
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>
                    恢复为系统内置默认文章详情样式
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

          {BUILTIN_POST_DETAIL_THEMES.map((t) => (
            <Grid item xs={12} sm={6} md={4} key={t.id} sx={{ display: 'flex' }}>
              <PostDetailThemeCard
                theme={t}
                isSelected={pendingActiveThemeId === t.id}
                isActive={activeThemeId === t.id}
                onApply={() => handleApplyTheme(t.id)}
                onReset={handleResetToDefault}
              />
            </Grid>
          ))}
        </Grid>
      </Paper>

      {editingTheme && pendingActiveThemeId !== '' && (
        <Fade in timeout={400}>
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
                  编辑「{editingTheme.name}」
                  {activeThemeId === editingThemeId && (
                    <Box
                      component="span"
                      sx={{
                        ml: 1,
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                        color: 'primary.main',
                        typography: 'caption',
                        fontWeight: 600,
                        verticalAlign: 'middle',
                      }}
                    >
                      正在使用
                    </Box>
                  )}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Refresh />}
                  onClick={() => {
                    const pkg = getThemeById(editingThemeId);
                    if (pkg) {
                      updateEditingDetailTheme(pkg.components?.postDetail || DEFAULT_POST_DETAIL_THEME);
                      enqueueSnackbar('已恢复默认参数', { variant: 'info' });
                    }
                  }}
                  sx={{ borderRadius: 1, flexShrink: 0 }}
                >
                  恢复默认
                </Button>
              </Box>
              <PostDetailThemeParamEditor
                schema={activeSchema}
                config={editingDetailTheme}
                onChange={updateEditingDetailTheme}
              />
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, sm: 3 },
                borderRadius: 1,
                mt: 3,
                boxShadow: (t) =>
                  t.palette.mode === 'light'
                    ? `0 4px 20px ${alpha(t.palette.primary.main, 0.08)}`
                    : `0 4px 20px ${alpha(t.palette.common.black, 0.25)}`,
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                实时预览
              </Typography>
              {previewLoading ? (
                <Loading text="加载预览中..." />
              ) : (
                <PostDetailThemePreview
                  post={previewPosts[0] || null}
                  theme={editingDetailTheme}
                />
              )}
            </Paper>
          </Box>
        </Fade>
      )}

      <FloatingSaveButton
        show={isDirty || pendingActiveThemeId !== activeThemeId}
        saving={saving}
        onClick={handleSave}
        label="保存主题"
      />
    </Stack>
  );
}
