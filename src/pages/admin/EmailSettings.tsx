import { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  alpha,
  Fade,
} from '@mui/material';
import { fetchEmailSettings, updateEmailSettings, type EmailSettings } from '@/api/admin';
import { Loading } from '@/components/Common/Loading';
import { FloatingSaveButton } from '@/components/Common/FloatingSaveButton';
import { useSnackbar } from 'notistack';
export function EmailSettings() {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<EmailSettings>({
    provider: 'resend',
    from: '',
    fromName: '',
    resendApiKey: '',
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    smtpSecure: false,
  });
  const [initialSettings, setInitialSettings] = useState<EmailSettings>(settings);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const data = await fetchEmailSettings();
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
  const isDirty = JSON.stringify(settings) !== JSON.stringify(initialSettings);
  const handleSave = async () => {
    setSaving(true);
    const ok = await updateEmailSettings(settings);
    if (ok) {
      try {
        const data = await fetchEmailSettings();
        if (data) {
          setSettings(data);
          setInitialSettings(data);
        }
      } catch {
      }
      enqueueSnackbar('邮箱配置已保存', { variant: 'success' });
    } else {
      enqueueSnackbar('保存失败，请稍后再试', { variant: 'error' });
    }
    setSaving(false);
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
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, overflowWrap: 'break-word' }}>
        邮箱配置
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, overflowWrap: 'break-word' }}>
        用于发送登录验证码等系统邮件。Cloudflare Workers 环境优先推荐 Resend API，SMTP 出站通常受限。
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <FormControl fullWidth>
          <InputLabel>发送方式</InputLabel>
          <Select
            value={settings.provider}
            label="发送方式"
            onChange={(e) => setSettings((s) => ({ ...s, provider: e.target.value as 'resend' | 'smtp' }))}
          >
            <MenuItem value="resend">Resend API</MenuItem>
            <MenuItem value="smtp">SMTP</MenuItem>
          </Select>
        </FormControl>
        <TextField
          label="发件人邮箱"
          value={settings.from}
          onChange={(e) => setSettings((s) => ({ ...s, from: e.target.value }))}
          fullWidth
          placeholder="noreply@example.com"
        />
        <TextField
          label="发件人名称"
          value={settings.fromName}
          onChange={(e) => setSettings((s) => ({ ...s, fromName: e.target.value }))}
          fullWidth
          placeholder="XinBlog"
        />
        {settings.provider === 'resend' && (
          <TextField
            label="Resend API Key"
            value={settings.resendApiKey}
            onChange={(e) => setSettings((s) => ({ ...s, resendApiKey: e.target.value }))}
            fullWidth
            placeholder="re_xxxxxxxx"
            type="password"
          />
        )}
        {settings.provider === 'smtp' && (
          <>
            <TextField
              label="SMTP 服务器"
              value={settings.smtpHost}
              onChange={(e) => setSettings((s) => ({ ...s, smtpHost: e.target.value }))}
              fullWidth
              placeholder="smtp.example.com"
            />
            <TextField
              label="SMTP 端口"
              value={settings.smtpPort}
              onChange={(e) => setSettings((s) => ({ ...s, smtpPort: parseInt(e.target.value || '0', 10) || 0 }))}
              fullWidth
              type="number"
            />
            <TextField
              label="SMTP 用户名"
              value={settings.smtpUser}
              onChange={(e) => setSettings((s) => ({ ...s, smtpUser: e.target.value }))}
              fullWidth
            />
            <TextField
              label="SMTP 密码"
              value={settings.smtpPass}
              onChange={(e) => setSettings((s) => ({ ...s, smtpPass: e.target.value }))}
              fullWidth
              type="password"
            />
            <FormControl fullWidth>
              <InputLabel>加密方式</InputLabel>
              <Select
                value={settings.smtpSecure ? 'tls' : 'none'}
                label="加密方式"
                onChange={(e) => setSettings((s) => ({ ...s, smtpSecure: e.target.value === 'tls' }))}
              >
                <MenuItem value="tls">TLS / SSL</MenuItem>
                <MenuItem value="none">无</MenuItem>
              </Select>
            </FormControl>
          </>
        )}
      </Box>
      <FloatingSaveButton show={isDirty} saving={saving} onClick={handleSave} label="保存配置" />
    </Paper>
    </Fade>
  );
}