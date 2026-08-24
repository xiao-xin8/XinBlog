import { useEffect, useState } from 'react';
import { Box, Paper, Typography, FormControlLabel, Switch, alpha, Fade } from '@mui/material';
import { useSiteStore } from '@/stores/siteStore';
import { Loading } from '@/components/Common/Loading';
import { FloatingSaveButton } from '@/components/Common/FloatingSaveButton';
import { useSnackbar } from 'notistack';

export function AdvancedSettings() {
  const { enqueueSnackbar } = useSnackbar();
  const site = useSiteStore();
  const [lazyLoadMedia, setLazyLoadMedia] = useState(site.config.lazyLoadMedia ?? false);
  const [initialLazyLoadMedia, setInitialLazyLoadMedia] = useState(site.config.lazyLoadMedia ?? false);
  const [enableLatex, setEnableLatex] = useState(site.config.enableLatex ?? false);
  const [initialEnableLatex, setInitialEnableLatex] = useState(site.config.enableLatex ?? false);
  const [disableSmoothScroll, setDisableSmoothScroll] = useState(site.config.disableSmoothScroll ?? false);
  const [initialDisableSmoothScroll, setInitialDisableSmoothScroll] = useState(site.config.disableSmoothScroll ?? false);
  const [imageDisplayMode, setImageDisplayMode] = useState(site.config.imageDisplayMode ?? 'fixed');
  const [initialImageDisplayMode, setInitialImageDisplayMode] = useState(site.config.imageDisplayMode ?? 'fixed');
  const [enableDashboardStats, setEnableDashboardStats] = useState(site.config.enableDashboardStats ?? true);
  const [initialEnableDashboardStats, setInitialEnableDashboardStats] = useState(site.config.enableDashboardStats ?? true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!site.loaded);

  useEffect(() => {
    if (site.loaded) {
      setLoading(false);
      setLazyLoadMedia(site.config.lazyLoadMedia ?? false);
      setInitialLazyLoadMedia(site.config.lazyLoadMedia ?? false);
      setEnableLatex(site.config.enableLatex ?? false);
      setInitialEnableLatex(site.config.enableLatex ?? false);
      setDisableSmoothScroll(site.config.disableSmoothScroll ?? false);
      setInitialDisableSmoothScroll(site.config.disableSmoothScroll ?? false);
      setImageDisplayMode(site.config.imageDisplayMode ?? 'fixed');
      setInitialImageDisplayMode(site.config.imageDisplayMode ?? 'fixed');
      setEnableDashboardStats(site.config.enableDashboardStats ?? true);
      setInitialEnableDashboardStats(site.config.enableDashboardStats ?? true);
    }
  }, [site.loaded, site.config.lazyLoadMedia, site.config.enableLatex, site.config.disableSmoothScroll, site.config.imageDisplayMode, site.config.enableDashboardStats]);

  const isDirty =
    lazyLoadMedia !== initialLazyLoadMedia ||
    enableLatex !== initialEnableLatex ||
    disableSmoothScroll !== initialDisableSmoothScroll ||
    imageDisplayMode !== initialImageDisplayMode ||
    enableDashboardStats !== initialEnableDashboardStats;

  const handleSave = async () => {
    setSaving(true);
    const ok = await site.saveConfig({ lazyLoadMedia, enableLatex, disableSmoothScroll, imageDisplayMode, enableDashboardStats });
    setSaving(false);
    if (ok) {
      setInitialLazyLoadMedia(lazyLoadMedia);
      setInitialEnableLatex(enableLatex);
      setInitialDisableSmoothScroll(disableSmoothScroll);
      setInitialImageDisplayMode(imageDisplayMode);
      setInitialEnableDashboardStats(enableDashboardStats);
      enqueueSnackbar('高级设置已保存', { variant: 'success' });
    } else {
      enqueueSnackbar('保存失败，请稍后再试', { variant: 'error' });
    }
  };

  if (loading) return <Loading />;

  return (
    <Fade in timeout={400}>
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
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, overflowWrap: 'break-word' }}>
        高级设置
      </Typography>


      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={lazyLoadMedia}
              onChange={(e) => setLazyLoadMedia(e.target.checked)}
            />
          }
          label="是否分次加载媒体资源"
        />
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'break-word' }}>
          开启后，大于 500KB 的大图片（文章封面、正文图片、主页背景、Logo 等）将在页面主要文字内容加载完成后，再按需要分批加载。这样可以加快首屏渲染速度，提升浏览体验；但图片请求会更多，可能多消耗 Worker 请求额度。媒体资源仍会通过浏览器缓存机制被缓存，重复访问时不会重复下载。
        </Typography>

        <FormControlLabel
          control={
            <Switch
              checked={enableLatex}
              onChange={(e) => setEnableLatex(e.target.checked)}
            />
          }
          label="是否启用 LaTeX 数学公式渲染"
        />
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'break-word' }}>
          启用后，文章中的 <code>$...$</code> 和 <code>$$...$$</code> 语法将被渲染为数学公式。开启会增加约 50KB 的页面加载量。如果不需要写公式，建议保持关闭。
        </Typography>

        <FormControlLabel
          control={
            <Switch
              checked={disableSmoothScroll}
              onChange={(e) => setDisableSmoothScroll(e.target.checked)}
            />
          }
          label="是否禁用页面平滑滚动"
        />
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'break-word' }}>
          关闭平滑滚动，页面将回退到浏览器原生滚动行为。当平滑滚动导致页面内部某些滚动区域无法正常使用（如目录、评论区或横向滚动容器）时，可开启此项解决。
        </Typography>

        <FormControlLabel
          control={
            <Switch
              checked={imageDisplayMode === 'natural'}
              onChange={(e) => setImageDisplayMode(e.target.checked ? 'natural' : 'fixed')}
            />
          }
          label="文章图片按自然比例显示（不占固定位置）"
        />
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'break-word' }}>
          开启后，文章正文图片按自身真实比例渲染，和原图长相一致，长条图不会被收窄或留大片空白。但图片区域高度不再固定，目录锚点定位可能不精准。关闭则每张图片占用固定区域（默认 4:3），目录定位稳定。
        </Typography>

        <FormControlLabel
          control={
            <Switch
              checked={enableDashboardStats}
              onChange={(e) => setEnableDashboardStats(e.target.checked)}
            />
          }
          label="后台概览页是否显示统计折线面板"
        />
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'break-word' }}>
          开启后，站点概览页会显示「内容趋势」折线统计（新增文章 / 评论 / 点赞 / 注册 / 媒体 的逐日变化）与总阅读量。管理员打开概览页时才会计算，对访客无任何影响。不需要的话可以关闭以隐藏该面板。
        </Typography>

      </Box>


      <FloatingSaveButton show={isDirty} saving={saving} onClick={handleSave} label="保存设置" />
    </Paper>

    </Fade>

  );
}
