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
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!site.loaded);
  useEffect(() => {
    if (site.loaded) {
      setLoading(false);
      setLazyLoadMedia(site.config.lazyLoadMedia ?? false);
      setInitialLazyLoadMedia(site.config.lazyLoadMedia ?? false);
    }
  }, [site.loaded, site.config.lazyLoadMedia]);
  const isDirty = lazyLoadMedia !== initialLazyLoadMedia;
  const handleSave = async () => {
    setSaving(true);
    const ok = await site.saveConfig({ lazyLoadMedia });
    setSaving(false);
    if (ok) {
      setInitialLazyLoadMedia(lazyLoadMedia);
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
      </Box>
      <FloatingSaveButton show={isDirty} saving={saving} onClick={handleSave} label="保存设置" />
    </Paper>
    </Fade>
  );
}