import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Grid,
  Paper,
  Stack,
  Typography,
  alpha,
  Fade,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useSiteStore, setCachedSiteConfig, normalizeSiteConfig } from '@/stores/siteStore';
import { ConfirmDialog } from '@/components/Common/ConfirmDialog';
import { FloatingSaveButton } from '@/components/Common/FloatingSaveButton';
import { Loading } from '@/components/Common/Loading';
import type { HeroConfig } from '@/types';

/** 可选的英雄区样式（bento 积木方案已下线，老数据会在 siteStore 中归一到 fullscreen） */
const HERO_MODES: { value: NonNullable<HeroConfig['mode']>; name: string; desc: string }[] = [
  { value: 'classic', name: '默认主题', desc: '经典英雄区，显示标题、副标题和搜索' },
  { value: 'fullscreen', name: '全屏主题', desc: '整屏背景图，滚动后显示文章；顶部导航透明悬浮' },
];

function ThemePreviewThumb({ variant }: { variant: 'classic' | 'fullscreen' }) {
  if (variant === 'fullscreen') {
    return (
      <svg viewBox="0 0 80 60" width="80" height="60" aria-hidden>
        <rect x="2" y="2" width="76" height="56" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
        {/* 顶部透明悬浮导航条 */}
        <rect x="2" y="2" width="76" height="9" fill="currentColor" opacity="0.12" />
        <circle cx="40" cy="26" r="7" fill="currentColor" opacity="0.22" />
        {/* 底部居中向下箭头 */}
        <path d="M36 44 L40 49 L44 44" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 80 60" width="80" height="60" aria-hidden>
      <rect x="2" y="2" width="76" height="56" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      <rect x="10" y="12" width="60" height="12" rx="3" fill="currentColor" opacity="0.16" />
      <rect x="24" y="28" width="32" height="6" rx="3" fill="currentColor" opacity="0.12" />
      <rect x="18" y="40" width="44" height="8" rx="4" fill="currentColor" opacity="0.1" />
    </svg>
  );
}

export function HeroThemePanel() {
  const site = useSiteStore();
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = useState(true);
  const [pendingMode, setPendingMode] = useState<HeroConfig['mode']>('classic');
  const [originalSnapshot, setOriginalSnapshot] = useState<HeroConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  // 参考 ThemeSettings 文章卡片面板：只在挂载时加载一次配置，避免保存时的乐观更新触发状态重置导致保存按钮消失。
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      await site.loadConfig();
      if (!mounted) return;
      const hero = site.config.hero || {};
      setPendingMode(hero.mode || 'classic');
      setOriginalSnapshot(JSON.parse(JSON.stringify({ ...hero, mode: hero.mode || 'classic' })));
      if (mounted) setLoading(false);
    };
    load();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savedHero: HeroConfig = useMemo(
    () => (originalSnapshot ? { ...originalSnapshot } : {}),
    [originalSnapshot]
  );

  const isDirty = useMemo(() => {
    if (!originalSnapshot) return false;
    return pendingMode !== originalSnapshot.mode;
  }, [pendingMode, originalSnapshot]);

  const handleSelect = (mode: NonNullable<HeroConfig['mode']>) => {
    setPendingMode(mode);
    const hit = HERO_MODES.find((m) => m.value === mode);
    enqueueSnackbar(`已选择「${hit?.name ?? mode}」，点击保存后生效`, { variant: 'info' });
  };

  const handleResetClick = () => setResetOpen(true);

  const handleResetConfirm = () => {
    setResetOpen(false);
    setPendingMode('classic');
    enqueueSnackbar('已选择默认主题，点击保存后生效', { variant: 'info' });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const nextHero: HeroConfig = {
        ...savedHero,
        mode: pendingMode,
      };
      const optimistic = normalizeSiteConfig({ ...site.config, hero: nextHero });
      site.setConfig({ hero: optimistic.hero });
      setCachedSiteConfig(optimistic);
      const ok = await site.saveConfig({ hero: nextHero });
      if (!ok) throw new Error('英雄区主题保存失败');
      // 保存成功后对齐原始快照，确保 isDirty 立即归零、悬浮保存按钮隐藏。
      setOriginalSnapshot(JSON.parse(JSON.stringify(nextHero)));
      enqueueSnackbar('英雄区主题已保存', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : '保存失败', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

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
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            英雄区主题
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            选择首页首屏的展示样式。背景图与标题文案请在「外观 → 英雄区」中配置，所有样式共用同一份配置。
          </Typography>
          <Grid container spacing={2}>
            {HERO_MODES.map((m) => {
              const selected = pendingMode === m.value;
              return (
                <Grid item xs={12} sm={6} md={4} key={m.value} sx={{ display: 'flex' }}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 1,
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      border: '2px solid',
                      borderColor: selected ? 'primary.main' : 'transparent',
                      bgcolor: (theme) =>
                        selected
                          ? alpha(theme.palette.primary.main, 0.06)
                          : alpha(theme.palette.primary.main, 0.02),
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Box sx={{ width: 80, height: 60, flexShrink: 0, mb: 1.5, color: 'text.primary' }}>
                      <ThemePreviewThumb variant={m.value} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" fontWeight={700}>
                        {m.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>
                        {m.desc}
                      </Typography>
                    </Box>
                    <Box sx={{ mt: 1.5 }}>
                      <Button
                        variant={selected ? 'outlined' : 'contained'}
                        size="small"
                        fullWidth
                        disabled={selected}
                        onClick={m.value === 'classic' ? handleResetClick : () => handleSelect(m.value)}
                        sx={{ borderRadius: 1 }}
                      >
                        {selected ? '已选中' : m.value === 'classic' ? '恢复默认' : '使用全屏'}
                      </Button>
                    </Box>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </Paper>

        <FloatingSaveButton show={isDirty} saving={saving} onClick={handleSave} label="保存英雄区主题" />

        <ConfirmDialog
          open={resetOpen}
          title="恢复默认主题"
          content="确定要切换回默认经典英雄区吗？点击保存后生效。"
          onConfirm={handleResetConfirm}
          onClose={() => setResetOpen(false)}
        />
      </Stack>
    </Fade>
  );
}