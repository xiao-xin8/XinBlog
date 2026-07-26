import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Fade,
  Grid,
  Paper,
  Stack,
  Typography,
  alpha,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useSiteStore, setCachedSiteConfig, normalizeSiteConfig } from '@/stores/siteStore';
import { BUILTIN_SCENE_THEMES } from '@/themes/scene/builtin';
import { getSceneThemeRenderer } from '@/themes/scene/renderers';
import { FloatingSaveButton } from '@/components/Common/FloatingSaveButton';
import { SceneThemeCard } from './SceneThemeCard';
import { SceneThemeParamEditor } from './SceneThemeParamEditor';
import type { SceneThemeConfig, ThemePackage } from '@/types';

const DEFAULT_SCENE_THEME: SceneThemeConfig = { variant: 'default' };


function buildEditingTheme(
  id: string,
  saved?: SceneThemeConfig
): { package: ThemePackage; config: SceneThemeConfig } | null {
  const pkg = BUILTIN_SCENE_THEMES.find((t) => t.id === id);
  if (!pkg) return null;
  const pkgScene = pkg.components?.scene || { variant: 'default' };
  const mergedConfig: SceneThemeConfig = saved?.variant === pkgScene.variant
    ? { ...pkgScene, params: { ...pkgScene.params, ...saved.params } }
    : { ...pkgScene };
  return { package: pkg, config: mergedConfig };
}

function resolveActiveBuiltinId(variant: string): string {
  if (variant === 'default') return '';
  return BUILTIN_SCENE_THEMES.find((b) => (b.components?.scene?.variant || '') === variant)?.id || '';
}

function getRendererSchema(variant: string) {
  const renderer = getSceneThemeRenderer(variant);
  return renderer?.schema || [];
}

export function SceneThemePanel() {
  const site = useSiteStore();
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeThemeId, setActiveThemeId] = useState<string>('');
  const [pendingThemeId, setPendingThemeId] = useState<string>('');
  const [pendingResetToDefault, setPendingResetToDefault] = useState(false);

  const [editingTheme, setEditingTheme] = useState<{ package: ThemePackage; config: SceneThemeConfig } | null>(null);
  const [originalEditingTheme, setOriginalEditingTheme] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      await site.loadConfig();
      if (!mounted) return;

      const variant = site.config.sceneTheme?.variant || 'default';
      const activeId = resolveActiveBuiltinId(variant);
      setActiveThemeId(activeId);
      setPendingThemeId(activeId);
      setPendingResetToDefault(false);

      if (activeId) {
        const editing = buildEditingTheme(activeId, site.config.sceneTheme);
        setEditingTheme(editing);
        setOriginalEditingTheme(JSON.stringify(editing?.config));
      } else {
        setEditingTheme(null);
        setOriginalEditingTheme('');
      }
      setLoading(false);
    };
    load();
    return () => {
      mounted = false;
    };
    
  }, []);

  const handleSelectTheme = (id: string) => {
    setPendingThemeId(id);
    setPendingResetToDefault(false);
    const savedVariant = site.config.sceneTheme?.variant || 'default';
    const savedId = resolveActiveBuiltinId(savedVariant);
    const editing = buildEditingTheme(id, id === savedId ? site.config.sceneTheme : undefined);
    setEditingTheme(editing);
    setOriginalEditingTheme(JSON.stringify(editing?.config));
    enqueueSnackbar('已选择该场景主题，点击保存后生效', { variant: 'info' });
  };

  const handleResetToDefault = () => {
    setPendingThemeId('');
    setPendingResetToDefault(true);
    setEditingTheme(null);
    setOriginalEditingTheme('');
    enqueueSnackbar('已选择默认主题，点击保存后生效', { variant: 'info' });
  };

  const handleUpdateConfig = (patch: Partial<SceneThemeConfig>) => {
    setEditingTheme((prev) => {
      if (!prev) return prev;
      return {
        package: prev.package,
        config: { ...prev.config, ...patch },
      };
    });
  };

  const handleResetParams = () => {
    if (!editingTheme) return;
    const pkgScene = editingTheme.package.components?.scene;
    if (!pkgScene) return;
    const renderer = getSceneThemeRenderer(pkgScene.variant);
    const defaults = renderer ? { variant: renderer.id, params: { ...renderer.defaultParams } } : { ...DEFAULT_SCENE_THEME };
    setEditingTheme({ package: editingTheme.package, config: defaults });
    enqueueSnackbar('已恢复默认参数，点击保存后生效', { variant: 'info' });
  };

  const isDirty = useMemo(() => {
    if (pendingThemeId !== activeThemeId || pendingResetToDefault) return true;
    if (!editingTheme) return false;
    return JSON.stringify(editingTheme.config) !== originalEditingTheme;
  }, [editingTheme, originalEditingTheme, pendingThemeId, activeThemeId, pendingResetToDefault]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const nextSceneTheme: SceneThemeConfig = pendingResetToDefault
        ? { ...DEFAULT_SCENE_THEME }
        : (editingTheme?.config ?? site.config.sceneTheme ?? DEFAULT_SCENE_THEME);

      const optimistic = normalizeSiteConfig({ ...site.config, sceneTheme: nextSceneTheme });
      site.setConfig({ sceneTheme: optimistic.sceneTheme });
      setCachedSiteConfig(optimistic);

      const ok = await site.saveConfig({ sceneTheme: nextSceneTheme });
      if (!ok) throw new Error('场景主题保存失败');

      const newActiveId = resolveActiveBuiltinId(nextSceneTheme.variant);
      setActiveThemeId(newActiveId);
      setPendingThemeId(newActiveId);
      setPendingResetToDefault(false);
      setOriginalEditingTheme(JSON.stringify(editingTheme?.config));
      enqueueSnackbar('场景主题已保存', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : '保存失败', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const activeSchema = useMemo(() => {
    return editingTheme?.config.schema || getRendererSchema(editingTheme?.config.variant || '');
  }, [editingTheme]);

  const renderThemeList = () => (
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
        所有场景主题
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
              borderColor: pendingThemeId === '' ? 'primary.main' : 'transparent',
              bgcolor: (t) =>
                pendingThemeId === ''
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
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    border: '2px dashed',
                    borderColor: 'text.secondary',
                    opacity: 0.5,
                  }}
                />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" fontWeight={700} noWrap>
                  默认主题
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ wordBreak: 'break-word', whiteSpace: 'normal' }}
                >
                  不使用场景动态特效
                </Typography>
              </Box>
            </Box>
            <Box sx={{ mt: 1.5 }}>
              <Button
                variant={pendingThemeId === '' ? 'outlined' : 'contained'}
                size="small"
                fullWidth
                disabled={pendingThemeId === ''}
                onClick={(e) => {
                  e.stopPropagation();
                  handleResetToDefault();
                }}
                sx={{ borderRadius: 1 }}
              >
                {pendingThemeId === '' ? '已选中' : '恢复默认'}
              </Button>
            </Box>
          </Paper>
        </Grid>
        {BUILTIN_SCENE_THEMES.map((theme) => (
          <Grid item xs={12} sm={6} md={4} key={theme.id} sx={{ display: 'flex' }}>
            <SceneThemeCard
              theme={theme}
              isSelected={pendingThemeId === theme.id}
              isActive={activeThemeId === theme.id}
              onApply={() => handleSelectTheme(theme.id)}
              onReset={handleResetToDefault}
            />
          </Grid>
        ))}
      </Grid>
    </Paper>
  );

  const renderEditor = () => {
    if (!editingTheme || pendingThemeId === '') return null;
    return (
      <Fade in timeout={400} key={editingTheme.package.id}>
        <Box>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, sm: 3 },
              borderRadius: 1,
              mb: 3,
              boxShadow: (t) =>
                t.palette.mode === 'light'
                  ? `0 4px 20px ${alpha(t.palette.primary.main, 0.08)}`
                  : `0 4px 20px ${alpha(t.palette.common.black, 0.25)}`,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 2,
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                编辑「{editingTheme.package.name}」
                {activeThemeId === editingTheme.package.id && (
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
                onClick={handleResetParams}
                sx={{ borderRadius: 1, flexShrink: 0 }}
              >
                恢复默认
              </Button>
            </Box>
            <SceneThemeParamEditor
              schema={activeSchema}
              config={editingTheme.config}
              onChange={handleUpdateConfig}
            />
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
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              实时预览
            </Typography>
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                height: { xs: 200, sm: 280 },
                borderRadius: 1,
                overflow: 'hidden',
                bgcolor: 'background.default',
                border: '1px solid',
                borderColor: 'divider',
                
                transform: 'scale(1)',
              }}
            >
              {(() => {
                const renderer = getSceneThemeRenderer(editingTheme.config.variant);
                if (!renderer) return null;
                const params = { ...renderer.defaultParams, ...(editingTheme.config.params || {}) };
                const EffectComponent = renderer.component;
                return <EffectComponent params={params} />;
              })()}
            </Box>
          </Paper>
        </Box>
      </Fade>
    );
  };

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
        <Typography>加载场景主题配置中...</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      {renderThemeList()}
      {renderEditor()}
      <FloatingSaveButton
        show={isDirty}
        saving={saving}
        onClick={handleSave}
        label="保存场景主题"
      />
    </Stack>
  );
}
