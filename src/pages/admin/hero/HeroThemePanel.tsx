import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  Grow,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
  alpha,
  Fade,
} from '@mui/material';
import {
  Add,
  Save,
  AccountCircle,
  AccessTime,
  Image,
  FormatQuote,
  MusicNote,
  Article,
  LocalOffer,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useSiteStore, setCachedSiteConfig, normalizeSiteConfig } from '@/stores/siteStore';
import { HeroBento } from '@/components/Hero/HeroBento';
import {
  getHeroWidgetDefinitions,
  getHeroWidgetDefinition,
  getHeroWidgetDefaultSize,
  getHeroWidgetSize,
  fillHeroWidgetProps,
  type PropSchema,
} from '@/components/Hero/heroWidgetRegistry';
import { ConfirmDialog } from '@/components/Common/ConfirmDialog';
import { FloatingSaveButton } from '@/components/Common/FloatingSaveButton';
import { Loading } from '@/components/Common/Loading';
import type { HeroConfig, HeroWidgetConfig, HeroLayout } from '@/types';

function generateWidgetId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

const FIXED_COLS = 6;
const MOBILE_MAX_WIDGETS = 4;
const FIXED_GAP = 16;

const WIDGET_ICON_MAP: Record<string, React.ComponentType<{ sx?: object }>> = {
  profile: AccountCircle,
  clock: AccessTime,
  image: Image,
  hitokoto: FormatQuote,
  music: MusicNote,
  posts: Article,
  tags: LocalOffer,
};

function defaultLayout(): HeroLayout {
  return { cols: FIXED_COLS, gap: FIXED_GAP, widgets: [] };
}

function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function hasWidgetCollisions(widgets: HeroWidgetConfig[]): boolean {
  for (let i = 0; i < widgets.length; i++) {
    for (let j = i + 1; j < widgets.length; j++) {
      if (rectsOverlap(widgets[i], widgets[j])) return true;
    }
  }
  return false;
}

function findFreePosition(
  widgets: HeroWidgetConfig[],
  w: number,
  h: number,
  cols: number
): { x: number; y: number } {
  const occupied = widgets.map((w) => ({ x: w.x, y: w.y, w: w.w, h: w.h }));
  const maxY = Math.max(0, ...widgets.map((w) => w.y + w.h));
  for (let y = 0; y <= maxY + h + 2; y++) {
    for (let x = 0; x <= cols - w; x++) {
      const candidate = { x, y, w, h };
      if (!occupied.some((o) => rectsOverlap(candidate, o))) {
        return { x, y };
      }
    }
  }
  return { x: 0, y: maxY + 1 };
}

function getPropValue(props: Record<string, unknown> | undefined, schema: PropSchema): unknown {
  if (props && schema.key in props) return props[schema.key];
  return schema.defaultValue;
}

function ThemePreviewThumb({ bento }: { bento?: boolean }) {
  const fill = bento ? '#6366f1' : undefined;
  return (
    <svg viewBox="0 0 80 60" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden>
      <rect x="2" y="2" width="76" height="56" rx="8" fill="currentColor" opacity={0.08} />
      {bento ? (
        <>
          <rect x="8" y="8" width="36" height="20" rx="4" fill={fill} opacity={0.2} />
          <rect x="48" y="8" width="24" height="20" rx="4" fill={fill} opacity={0.14} />
          <rect x="8" y="32" width="24" height="20" rx="4" fill={fill} opacity={0.14} />
          <rect x="36" y="32" width="36" height="20" rx="4" fill={fill} opacity={0.2} />
        </>
      ) : (
        <>
          <rect x="12" y="16" width="56" height="8" rx="4" fill="currentColor" opacity={0.2} />
          <rect x="20" y="30" width="40" height="6" rx="3" fill="currentColor" opacity={0.12} />
          <rect x="28" y="42" width="24" height="6" rx="3" fill="currentColor" opacity={0.12} />
        </>
      )}
    </svg>
  );
}

export function HeroThemePanel() {
  const site = useSiteStore();
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = useState(true);
  const [pendingMode, setPendingMode] = useState<'classic' | 'bento'>('classic');
  const [widgets, setWidgets] = useState<HeroWidgetConfig[]>([]);
  const [originalSnapshot, setOriginalSnapshot] = useState<HeroConfig | null>(null);
  const [saving, setSaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<HeroWidgetConfig | null>(null);
  const [editProps, setEditProps] = useState<Record<string, unknown>>({});
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; widget: HeroWidgetConfig | null }>({
    open: false,
    widget: null,
  });

  
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      await site.loadConfig();
      if (!mounted) return;
      const hero = site.config.hero || {};
      const layout = { ...(hero.layout || defaultLayout()), cols: FIXED_COLS, gap: FIXED_GAP };
      setPendingMode(hero.mode || 'classic');
      setWidgets(layout.widgets || []);
      setOriginalSnapshot(JSON.parse(JSON.stringify({ ...hero, mode: hero.mode || 'classic', layout })));
      if (mounted) setLoading(false);
    };
    load();
    return () => {
      mounted = false;
    };
    
  }, []);

  const savedHero = useMemo(() => site.config.hero || {}, [site.config.hero]);

  const previewHero: HeroConfig = useMemo(
    () => ({
      ...savedHero,
      mode: pendingMode,
      layout: {
        cols: FIXED_COLS,
        gap: FIXED_GAP,
        widgets: widgets.map(fillHeroWidgetProps),
      },
    }),
    [savedHero, pendingMode, widgets]
  );

  const isDirty = useMemo(() => {
    if (!originalSnapshot) return false;
    if (pendingMode !== originalSnapshot.mode) return true;
    return JSON.stringify(widgets) !== JSON.stringify((originalSnapshot.layout || defaultLayout()).widgets || []);
  }, [pendingMode, widgets, originalSnapshot]);

  const handleResetToDefault = () => {
    setPendingMode('classic');
    enqueueSnackbar('已选择默认英雄区主题，点击保存后生效', { variant: 'info' });
  };

  const handleApplyBento = () => {
    setPendingMode('bento');
    enqueueSnackbar('已选择自定义多功能主题，点击保存后生效', { variant: 'info' });
  };

  const handleAddWidget = (type: string) => {
    const def = getHeroWidgetDefinition(type);
    if (!def) return;
    const size = getHeroWidgetDefaultSize(type);
    const pos = findFreePosition(widgets, size.w, size.h, FIXED_COLS);
    const mobileVisibleCount = widgets.filter((w) => !w.hideOnMobile).length;
    const shouldHideOnMobile = mobileVisibleCount >= MOBILE_MAX_WIDGETS;
    const next: HeroWidgetConfig = {
      id: generateWidgetId(),
      type,
      x: pos.x,
      y: pos.y,
      w: size.w,
      h: size.h,
      props: { ...def.defaultProps },
      hideOnMobile: shouldHideOnMobile,
    };
    setWidgets((prev) => [...prev, next]);
    if (shouldHideOnMobile) {
      enqueueSnackbar(`移动端最多显示 ${MOBILE_MAX_WIDGETS} 个组件，新组件已默认设为移动端隐藏`, { variant: 'info' });
    }
  };

  const handleEdit = (widget: HeroWidgetConfig) => {
    setEditingWidget(widget);
    setEditProps(widget.props ? { ...widget.props } : {});
    setEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingWidget) return;
    setWidgets((prev) =>
      prev.map((w) =>
        w.id === editingWidget.id
          ? {
              ...editingWidget,
              props: { ...editProps },
            }
          : w
      )
    );
    setEditOpen(false);
    setEditingWidget(null);
    setEditProps({});
  };

  const handleToggleHideOnMobile = () => {
    if (!editingWidget) return;
    const willShowOnMobile = editingWidget.hideOnMobile === true;
    if (willShowOnMobile) {
      const mobileVisibleCount = widgets.filter((w) => w.id !== editingWidget.id && !w.hideOnMobile).length;
      if (mobileVisibleCount >= MOBILE_MAX_WIDGETS) {
        enqueueSnackbar(`移动端最多显示 ${MOBILE_MAX_WIDGETS} 个组件，请先隐藏其他组件`, { variant: 'warning' });
        return;
      }
    }
    setEditingWidget((prev) => (prev ? { ...prev, hideOnMobile: !prev.hideOnMobile } : prev));
  };

  const handleDelete = (widget: HeroWidgetConfig) => {
    setDeleteDialog({ open: true, widget });
  };

  const confirmDelete = () => {
    if (!deleteDialog.widget) return;
    setWidgets((prev) => prev.filter((w) => w.id !== deleteDialog.widget!.id));
    setDeleteDialog({ open: false, widget: null });
  };

  const hasCollisions = useMemo(() => hasWidgetCollisions(widgets), [widgets]);

  const handleSave = async () => {
    if (pendingMode === 'bento' && hasCollisions) {
      enqueueSnackbar('组件布局存在重叠，请调整后再保存', { variant: 'error' });
      return;
    }
    setSaving(true);
    try {
      const nextHero: HeroConfig = {
        ...savedHero,
        mode: pendingMode,
        layout:
          pendingMode === 'bento'
            ? { cols: FIXED_COLS, gap: FIXED_GAP, widgets }
            : savedHero.layout || { cols: FIXED_COLS, gap: FIXED_GAP, widgets: [] },
      };
      const optimistic = normalizeSiteConfig({ ...site.config, hero: nextHero });
      site.setConfig({ hero: optimistic.hero });
      setCachedSiteConfig(optimistic);
      const ok = await site.saveConfig({ hero: nextHero });
      if (!ok) throw new Error('英雄区主题保存失败');
      
      setOriginalSnapshot(JSON.parse(JSON.stringify(nextHero)));
      enqueueSnackbar('英雄区主题已保存', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : '保存失败', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const definitions = getHeroWidgetDefinitions();

  if (loading) {
    return <Loading text="加载英雄区主题中..." />;
  }

  return (
    <Fade in timeout={400}>
      <Stack spacing={3}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, sm: 3 },
            borderRadius: 1,
            boxShadow: (theme) =>
              theme.palette.mode === 'light'
                ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
                : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            英雄区主题
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4} sx={{ display: 'flex' }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 1,
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  border: '2px solid',
                  borderColor: pendingMode === 'classic' ? 'primary.main' : 'transparent',
                  bgcolor: (theme) =>
                    pendingMode === 'classic'
                      ? alpha(theme.palette.primary.main, 0.06)
                      : alpha(theme.palette.primary.main, 0.02),
                  transition: 'all 0.2s ease',
                }}
              >
                <Box sx={{ width: 80, height: 60, flexShrink: 0, mb: 1.5, color: 'text.primary' }}>
                  <ThemePreviewThumb />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    默认主题
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>
                    经典英雄区，显示标题、副标题和搜索
                  </Typography>
                </Box>
                <Box sx={{ mt: 1.5 }}>
                  <Button
                    variant={pendingMode === 'classic' ? 'outlined' : 'contained'}
                    size="small"
                    fullWidth
                    disabled={pendingMode === 'classic'}
                    onClick={handleResetToDefault}
                    sx={{ borderRadius: 1 }}
                  >
                    {pendingMode === 'classic' ? '已选中' : '恢复默认'}
                  </Button>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={4} sx={{ display: 'flex' }}>
              <Paper
                elevation={0}
                sx={{
                  position: 'relative',
                  p: 2,
                  borderRadius: 1,
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  border: '2px solid',
                  borderColor: pendingMode === 'bento' ? 'primary.main' : 'transparent',
                  bgcolor: (theme) =>
                    pendingMode === 'bento'
                      ? alpha(theme.palette.primary.main, 0.06)
                      : alpha(theme.palette.primary.main, 0.02),
                  transition: 'all 0.2s ease',
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    px: 1,
                    py: 0.25,
                    bgcolor: 'warning.main',
                    color: 'warning.contrastText',
                    borderBottomLeftRadius: 10,
                    fontSize: '10px',
                    fontWeight: 800,
                    letterSpacing: 0.5,
                    zIndex: 1,
                  }}
                >
                  测试功能
                </Box>
                <Box sx={{ width: 80, height: 60, flexShrink: 0, mb: 1.5, color: 'text.primary' }}>
                  <ThemePreviewThumb bento />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    自定义多功能
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>
                    像拼积木一样自由组合个人介绍、时间、图片等组件
                  </Typography>
                </Box>
                <Box sx={{ mt: 1.5 }}>
                  <Button
                    variant={pendingMode === 'bento' ? 'outlined' : 'contained'}
                    size="small"
                    fullWidth
                    disabled={pendingMode === 'bento'}
                    onClick={handleApplyBento}
                    sx={{ borderRadius: 1 }}
                  >
                    {pendingMode === 'bento' ? '已选中' : '应用'}
                  </Button>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Paper>

        {pendingMode === 'bento' && (
          <Fade in timeout={400}>
            <Stack spacing={3}>
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 2, sm: 3 },
                  borderRadius: 1,
                  boxShadow: (theme) =>
                    theme.palette.mode === 'light'
                      ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
                      : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  组件库
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  点击卡片即可添加组件；每个组件尺寸已按类型预设，在下方预览区直接拖拽调整位置。
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
                    gap: 1.5,
                  }}
                >
                  {definitions.map((def) => {
                    const Icon = WIDGET_ICON_MAP[def.id];
                    return (
                      <Box
                        key={def.id}
                        onClick={() => handleAddWidget(def.id)}
                        sx={{
                          position: 'relative',
                          p: 1.5,
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: (theme) => alpha(theme.palette.background.paper, 0.6),
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 1,
                          transition: (theme) =>
                            theme.transitions.create(['transform', 'box-shadow', 'border-color', 'background-color'], {
                              duration: theme.transitions.duration.short,
                            }),
                          '&:hover': {
                            transform: 'translateY(-2px) scale(1.02)',
                            borderColor: 'primary.main',
                            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
                            boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette.primary.main, 0.12)}`,
                            '& > :last-child': { opacity: 1 },
                          },
                        }}
                      >
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                            color: 'primary.main',
                          }}
                        >
                          {Icon ? <Icon sx={{ fontSize: 26 }} /> : <Add sx={{ fontSize: 26 }} />}
                        </Box>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="body2" fontWeight={700}>
                            {def.name}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {def.description}
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                            opacity: 0,
                            transition: (theme) => theme.transitions.create('opacity', { duration: theme.transitions.duration.short }),
                          }}
                        >
                          <Add sx={{ fontSize: 14 }} />
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: { xs: 2, sm: 3 },
                  borderRadius: 1,
                  boxShadow: (theme) =>
                    theme.palette.mode === 'light'
                      ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
                      : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    实时预览
                  </Typography>
                  {hasCollisions && (
                    <Typography variant="caption" color="error" fontWeight={600}>
                      检测到组件重叠，保存前请调整布局
                    </Typography>
                  )}
                </Box>
                <Box sx={{ borderRadius: 1, overflow: 'hidden' }}>
                  <HeroBento
                    hero={previewHero}
                    editable
                    onChange={setWidgets}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                </Box>
              </Paper>
            </Stack>
          </Fade>
        )}

        <FloatingSaveButton show={isDirty} saving={saving} onClick={handleSave} label="保存英雄区主题" />

        <Dialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          maxWidth="sm"
          fullWidth
          scroll="paper"
          disableRestoreFocus
          TransitionComponent={Grow}
          PaperProps={{ sx: { borderRadius: { xs: 2, sm: '12px' } } }}
        >
          <DialogTitle sx={{ fontWeight: 700 }}>编辑组件</DialogTitle>
          <DialogContent>
            {editingWidget && (
              <Stack spacing={3} sx={{ mt: 0.5 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!editingWidget.hideOnMobile}
                      onChange={handleToggleHideOnMobile}
                    />
                  }
                  label={editingWidget.hideOnMobile ? '移动端隐藏' : '移动端显示'}
                />

                {(() => {
                  const def = getHeroWidgetDefinition(editingWidget.type);
                  if (!def || def.sizes.length <= 1) return null;
                  const current = getHeroWidgetSize(editingWidget.type, editingWidget.w, editingWidget.h);
                  return (
                    <FormControl fullWidth>
                      <InputLabel id="widget-size-label">组件尺寸</InputLabel>
                      <Select
                        labelId="widget-size-label"
                        value={current ? `${current.w}x${current.h}` : `${def.sizes[0].w}x${def.sizes[0].h}`}
                        label="组件尺寸"
                        onChange={(e) => {
                          const [nw, nh] = e.target.value.split('x').map((v) => parseInt(v, 10));
                          setEditingWidget((w) =>
                            w ? { ...w, w: nw, h: nh, x: Math.min(w.x, FIXED_COLS - nw) } : w
                          );
                        }}
                      >
                        {def.sizes.map((s) => (
                          <MenuItem key={`${s.w}x${s.h}`} value={`${s.w}x${s.h}`}>
                            {s.label || `${s.w} × ${s.h}`}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  );
                })()}

                {getHeroWidgetDefinition(editingWidget.type)?.propSchema.map((schema) => {
                  const value = getPropValue(editProps, schema);
                  if (schema.type === 'boolean') {
                    return (
                      <FormControlLabel
                        key={schema.key}
                        control={
                          <Switch
                            checked={!!value}
                            onChange={(e) => setEditProps((p) => ({ ...p, [schema.key]: e.target.checked }))}
                          />
                        }
                        label={schema.label}
                      />
                    );
                  }
                  if (schema.type === 'select') {
                    return (
                      <FormControl key={schema.key} fullWidth>
                        <InputLabel id={`prop-${schema.key}-label`}>{schema.label}</InputLabel>
                        <Select
                          labelId={`prop-${schema.key}-label`}
                          value={String(value ?? '')}
                          label={schema.label}
                          onChange={(e) => setEditProps((p) => ({ ...p, [schema.key]: e.target.value }))}
                        >
                          {(schema.options || []).map((opt) => (
                            <MenuItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    );
                  }
                  if (schema.type === 'number') {
                    const numeric = Number(value ?? schema.defaultValue ?? 0);
                    return (
                      <Box key={schema.key}>
                        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                          {schema.label}：{numeric.toFixed(2)}
                        </Typography>
                        <Slider
                          value={numeric}
                          onChange={(_, v) => setEditProps((p) => ({ ...p, [schema.key]: v as number }))}
                          min={schema.min ?? 0}
                          max={schema.max ?? 1}
                          step={schema.step ?? 0.01}
                          valueLabelDisplay="auto"
                        />
                      </Box>
                    );
                  }
                  return (
                    <TextField
                      key={schema.key}
                      label={schema.label}
                      value={String(value ?? '')}
                      onChange={(e) => setEditProps((p) => ({ ...p, [schema.key]: e.target.value }))}
                      placeholder={schema.placeholder}
                      fullWidth
                    />
                  );
                })}
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setEditOpen(false)} color="inherit">
              取消
            </Button>
            <Button onClick={handleSaveEdit} variant="contained" startIcon={<Save />}>
              保存
            </Button>
          </DialogActions>
        </Dialog>

        <ConfirmDialog
          open={deleteDialog.open}
          title="删除组件"
          content={`确定删除「${getHeroWidgetDefinition(deleteDialog.widget?.type || '')?.name || deleteDialog.widget?.type}」吗？`}
          confirmText="删除"
          confirmColor="error"
          onClose={() => setDeleteDialog({ open: false, widget: null })}
          onConfirm={confirmDelete}
        />
      </Stack>
    </Fade>
  );
}
