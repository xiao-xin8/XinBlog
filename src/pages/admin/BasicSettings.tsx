import { useEffect, useState } from 'react';
import { Box, Paper, Typography, FormControlLabel, Switch, alpha, Fade } from '@mui/material';
import { fetchAuthSettings, updateAuthSettings, type AuthSettings } from '@/api/admin';
import { Loading } from '@/components/Common/Loading';
import { FloatingSaveButton } from '@/components/Common/FloatingSaveButton';
import { useSnackbar } from 'notistack';

export function BasicSettings() {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AuthSettings>({
    allowRegister: true,
    emailVerification: false,
  });
  const [initialSettings, setInitialSettings] = useState<AuthSettings>(settings);
  const isDirty = JSON.stringify(settings) !== JSON.stringify(initialSettings);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const data = await fetchAuthSettings();
      if (!cancelled && data) {
        setSettings(data);
        setInitialSettings(data);
      }
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const ok = await updateAuthSettings(settings);
    setSaving(false);
    if (ok) {
      setInitialSettings(settings);
      enqueueSnackbar('基础设置已保存', { variant: 'success' });
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
        基础设置
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={settings.allowRegister}
              onChange={(e) => setSettings((s) => ({ ...s, allowRegister: e.target.checked }))}
            />
          }
          label="允许用户注册"
        />
        <FormControlLabel
          control={
            <Switch
              checked={settings.emailVerification}
              onChange={(e) => setSettings((s) => ({ ...s, emailVerification: e.target.checked }))}
            />
          }
          label="注册时启用邮箱验证码"
        />
      </Box>

      <FloatingSaveButton show={isDirty} saving={saving} onClick={handleSave} label="保存设置" />
    </Paper>
    </Fade>
  );
}
