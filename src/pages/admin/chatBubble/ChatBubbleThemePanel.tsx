import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Fade, Grid, Paper, Stack, Typography, alpha, useTheme } from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useSiteStore, setCachedSiteConfig, normalizeSiteConfig } from '@/stores/siteStore';
import { BUILTIN_CHAT_BUBBLE_THEMES } from '@/themes/chatBubble/builtin';
import { getChatBubbleRenderer } from '@/themes/chatBubble/renderers';
import { FloatingSaveButton } from '@/components/Common/FloatingSaveButton';
import { ChatBubbleThemeCard } from './ChatBubbleThemeCard';
import { ChatBubbleParamEditor } from './ChatBubbleParamEditor';
import type { ChatBubbleThemeConfig, ThemePackage } from '@/types';

const DEFAULT_CHAT_BUBBLE_THEME: ChatBubbleThemeConfig = { variant: 'default' };

function buildEditingTheme(id: string, saved?: ChatBubbleThemeConfig): { package: ThemePackage; config: ChatBubbleThemeConfig } | null {
  const pkg = BUILTIN_CHAT_BUBBLE_THEMES.find((t) => t.id === id);
  if (!pkg) return null;
  const pkgCb = pkg.components?.chatBubble || { variant: 'default' };
  const mergedConfig: ChatBubbleThemeConfig =
    saved?.variant === pkgCb.variant ? { ...pkgCb, params: { ...pkgCb.params, ...saved.params } } : { ...pkgCb };
  return { package: pkg, config: mergedConfig };
}

function resolveActiveBuiltinId(variant: string): string {
  if (variant === 'default') return '';
  return BUILTIN_CHAT_BUBBLE_THEMES.find((b) => (b.components?.chatBubble?.variant || '') === variant)?.id || '';
}

function getRendererSchema(variant: string) {
  const renderer = getChatBubbleRenderer(variant);
  return renderer?.schema || [];
}

export function ChatBubbleThemePanel() {
  const site = useSiteStore();
  const muiTheme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeThemeId, setActiveThemeId] = useState<string>('');
  const [pendingThemeId, setPendingThemeId] = useState<string>('');
  const [pendingResetToDefault, setPendingResetToDefault] = useState(false);

  const [editingTheme, setEditingTheme] = useState<{ package: ThemePackage; config: ChatBubbleThemeConfig } | null>(null);
  const [originalEditingTheme, setOriginalEditingTheme] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      await site.loadConfig();
      if (!mounted) return;

      const variant = site.config.chatBubbleTheme?.variant || 'default';
      const activeId = resolveActiveBuiltinId(variant);
      setActiveThemeId(activeId);
      setPendingThemeId(activeId);
      setPendingResetToDefault(false);

      if (activeId) {
        const editing = buildEditingTheme(activeId, site.config.chatBubbleTheme);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectTheme = (id: string) => {
    setPendingThemeId(id);
    setPendingResetToDefault(false);
    const savedVariant = site.config.chatBubbleTheme?.variant || 'default';
    const savedId = resolveActiveBuiltinId(savedVariant);
    const editing = buildEditingTheme(id, id === savedId ? site.config.chatBubbleTheme : undefined);
    setEditingTheme(editing);
    setOriginalEditingTheme(JSON.stringify(editing?.config));
    enqueueSnackbar('已选择该聊天气泡主题，点击保存后生效', { variant: 'info' });
  };

  const handleResetToDefault = () => {
    setPendingThemeId('');
    setPendingResetToDefault(true);
    setEditingTheme(null);
    setOriginalEditingTheme('');
    enqueueSnackbar('已选择默认主题，点击保存后生效', { variant: 'info' });
  };

  const handleUpdateConfig = (patch: Partial<ChatBubbleThemeConfig>) => {
    setEditingTheme((prev) => {
      if (!prev) return prev;
      return { package: prev.package, config: { ...prev.config, ...patch } };
    });
  };

  const handleResetParams = () => {
    if (!editingTheme) return;
    const pkgCb = editingTheme.package.components?.chatBubble;
    if (!pkgCb) return;
    const renderer = getChatBubbleRenderer(pkgCb.variant);
    const defaults: ChatBubbleThemeConfig = renderer
      ? { variant: renderer.id, params: { ...renderer.defaultParams } }
      : { ...DEFAULT_CHAT_BUBBLE_THEME };
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
      const nextChatBubbleTheme: ChatBubbleThemeConfig = pendingResetToDefault
        ? { ...DEFAULT_CHAT_BUBBLE_THEME }
        : (editingTheme?.config ?? site.config.chatBubbleTheme ?? DEFAULT_CHAT_BUBBLE_THEME);

      const optimistic = normalizeSiteConfig({ ...site.config, chatBubbleTheme: nextChatBubbleTheme });
      site.setConfig({ chatBubbleTheme: optimistic.chatBubbleTheme });
      setCachedSiteConfig(optimistic);

      const ok = await site.saveConfig({ chatBubbleTheme: nextChatBubbleTheme });
      if (!ok) throw new Error('聊天气泡主题保存失败');

      const newActiveId = resolveActiveBuiltinId(nextChatBubbleTheme.variant);
      setActiveThemeId(newActiveId);
      setPendingThemeId(newActiveId);
      setPendingResetToDefault(false);
      setOriginalEditingTheme(JSON.stringify(editingTheme?.config));
      enqueueSnackbar('聊天气泡主题已保存', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : '保存失败', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const activeSchema = useMemo(() => {
    return editingTheme?.config.schema || getRendererSchema(editingTheme?.config.variant || '');
  }, [editingTheme]);

  // 预览用的左右气泡样式，实时跟随编辑参数
  const previewOutput = useMemo(() => {
    if (!editingTheme) return null;
    const renderer = getChatBubbleRenderer(editingTheme.config.variant);
    if (!renderer) return null;
    const params = { ...renderer.defaultParams, ...(editingTheme.config.params || {}) };
    return renderer.render(params, {
      // 主题色取自项目真实主题色（MUI primary），保证预览与前台一致
      themeColor: muiTheme.palette.primary.main,
      borderRadius: muiTheme.shape.borderRadius ?? 16,
    });
  }, [editingTheme, muiTheme.palette.primary.main, muiTheme.shape.borderRadius]);

  const themeColor = muiTheme.palette.primary.main;

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
        所有聊天气泡主题
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
                pendingThemeId === '' ? alpha(t.palette.primary.main, 0.06) : alpha(t.palette.primary.main, 0.02),
              transition: 'all 0.2s ease',
            }}
          >
            <Typography variant="subtitle2" fontWeight={700} noWrap sx={{ flexGrow: 1 }}>
              默认主题
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
              使用默认气泡配色
            </Typography>
            <Box sx={{ mt: 1.5 }}>
              <Button
                variant={pendingThemeId === '' ? 'outlined' : 'contained'}
                size="small"
                fullWidth
                disabled={pendingThemeId === ''}
                onClick={handleResetToDefault}
                sx={{ borderRadius: 1 }}
              >
                {pendingThemeId === '' ? '已选中' : '恢复默认'}
              </Button>
            </Box>
          </Paper>
        </Grid>
        {BUILTIN_CHAT_BUBBLE_THEMES.map((theme) => (
          <Grid item xs={12} sm={6} md={4} key={theme.id} sx={{ display: 'flex' }}>
            <ChatBubbleThemeCard
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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                编辑「{editingTheme.package.name}」
                {activeThemeId === editingTheme.package.id && (
                  <Box component="span" sx={{ ml: 1, px: 1, py: 0.25, borderRadius: 1, bgcolor: (t) => alpha(t.palette.primary.main, 0.1), color: 'primary.main', typography: 'caption', fontWeight: 600, verticalAlign: 'middle' }}>
                    正在使用
                  </Box>
                )}
              </Typography>
              <Button variant="outlined" size="small" startIcon={<Refresh />} onClick={handleResetParams} sx={{ borderRadius: 1, flexShrink: 0 }}>
                恢复默认
              </Button>
            </Box>
            <ChatBubbleParamEditor schema={activeSchema} config={editingTheme.config} onChange={handleUpdateConfig} />
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
                p: 2,
                borderRadius: 1,
                bgcolor: 'background.default',
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                minHeight: 180,
              }}
            >
              <Box sx={{ alignSelf: 'flex-start', maxWidth: '72%', px: 1.5, py: 0.9, ...(previewOutput?.other || {}) }}>
                收到一条消息，这是对方的气泡效果。
              </Box>
              <Box sx={{ alignSelf: 'flex-end', maxWidth: '72%', px: 1.5, py: 0.9, ...(previewOutput?.mine || {}) }}>
                这是你自己发送的消息气泡。
              </Box>
              <Typography variant="caption" color="text.secondary">
                主色：<Box component="span" sx={{ color: themeColor, fontWeight: 600 }}>{themeColor}</Box>
              </Typography>
            </Box>
          </Paper>
        </Box>
      </Fade>
    );
  };

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
        <Typography>加载聊天气泡主题配置中...</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      {renderThemeList()}
      {renderEditor()}
      <FloatingSaveButton show={isDirty} saving={saving} onClick={handleSave} label="保存聊天气泡主题" />
    </Stack>
  );
}