import { useEffect, useState } from 'react';
import {
  Paper,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  FormControlLabel,
  Switch,
  Alert,
  alpha,
  Fade,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import {
  fetchAuthSettings,
  updateAuthSettings,
  type AuthSettings,
} from '@/api/admin';
import { Loading } from '@/components/Common/Loading';
import { FloatingSaveButton } from '@/components/Common/FloatingSaveButton';

const MODE_OPTIONS: { value: AuthSettings['verificationMode']; label: string; desc: string }[] = [
  {
    value: 'none',
    label: '不验证',
    desc: '发送验证码不进行任何人机验证。风险最高，容易被脚本刷爆邮件，不建议使用。',
  },
  {
    value: 'math',
    label: '服务器算术验证',
    desc: '由服务器生成随机算术题并校验答案，无需外部配置，可挡普通脚本。',
  },
  {
    value: 'turnstile',
    label: 'Cloudflare Turnstile',
    desc: 'Cloudflare 官方验证（免费）。需先在 Cloudflare 控制台创建 widget，获取 Site Key 与 Secret Key。',
  },
  {
    value: 'geetest',
    label: '极验 GT4',
    desc: '国内验证码服务。需先在极验平台申请应用，获取 Captcha ID 与 Captcha Key。',
  },
  {
    value: 'hcaptcha',
    label: 'hCaptcha',
    desc: 'Cloudflare 出品的隐私友好验证码，海外效果好。需在 hCaptcha 官网注册应用，获取 Site Key 与 Secret Key。',
  },
];

// 用户管理 → 验证设置
export function VerificationSettings() {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState<AuthSettings | null>(null);
  const [mode, setMode] = useState<AuthSettings['verificationMode']>('none');
  const [loginVerification, setLoginVerification] = useState(false);
  const [registerVerification, setRegisterVerification] = useState(false);
  const [forgotPasswordVerification, setForgotPasswordVerification] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileSecret, setTurnstileSecret] = useState('');
  const [geetestCaptchaId, setGeetestCaptchaId] = useState('');
  const [geetestCaptchaKey, setGeetestCaptchaKey] = useState('');
  const [hcaptchaSiteKey, setHcaptchaSiteKey] = useState('');
  const [hcaptchaSecret, setHcaptchaSecret] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchAuthSettings();
      if (cancelled) return;
      if (data) {
        setLoaded(data);
        setMode(data.verificationMode || 'none');
        setLoginVerification(data.loginVerification === true);
        setRegisterVerification(data.registerVerification === true);
        setForgotPasswordVerification(data.forgotPasswordVerification === true);
        setTurnstileSiteKey(data.turnstileSiteKey || '');
        // 密钥不回显，输入框留空；已配置时以占位提示
        setTurnstileSecret('');
        setGeetestCaptchaId(data.geetestCaptchaId || '');
        setGeetestCaptchaKey('');
        setHcaptchaSiteKey(data.hcaptchaSiteKey || '');
        setHcaptchaSecret('');
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    if (!loaded) return;
    setSaving(true);
    const payload: AuthSettings = {
      ...loaded,
      verificationMode: mode,
      loginVerification,
      registerVerification,
      forgotPasswordVerification,
      turnstileSiteKey: turnstileSiteKey.trim(),
      // 留空表示保持原值（后端对空串/**** 均不覆盖）
      turnstileSecret: turnstileSecret.trim() || '****',
      geetestCaptchaId: geetestCaptchaId.trim(),
      geetestCaptchaKey: geetestCaptchaKey.trim() || '****',
      hcaptchaSiteKey: hcaptchaSiteKey.trim(),
      hcaptchaSecret: hcaptchaSecret.trim() || '****',
    };
    const ok = await updateAuthSettings(payload);
    setSaving(false);
    if (ok) {
      enqueueSnackbar('验证设置已保存', { variant: 'success' });
      // 保存成功后清空密钥输入框，避免下次误提交
      setTurnstileSecret('');
      setGeetestCaptchaKey('');
      setHcaptchaSecret('');
      setLoaded(payload);
    } else {
      enqueueSnackbar('保存失败，请稍后再试', { variant: 'error' });
    }
  };

  if (loading) return <Loading />;

  const current = MODE_OPTIONS.find((o) => o.value === mode) || MODE_OPTIONS[0];

  // 与已保存值比对，改动后显示浮动保存按钮（密钥不回显，仅在新填值时视为改动）
  const isDirty = !!loaded && (
    mode !== loaded.verificationMode ||
    loginVerification !== !!loaded.loginVerification ||
    registerVerification !== !!loaded.registerVerification ||
    forgotPasswordVerification !== !!loaded.forgotPasswordVerification ||
    turnstileSiteKey.trim() !== (loaded.turnstileSiteKey || '') ||
    geetestCaptchaId.trim() !== (loaded.geetestCaptchaId || '') ||
    turnstileSecret.trim() !== '' ||
    geetestCaptchaKey.trim() !== '' ||
    hcaptchaSiteKey.trim() !== (loaded.hcaptchaSiteKey || '') ||
    hcaptchaSecret.trim() !== ''
  );

  return (
    <Fade in timeout={400}>
      <Paper
        elevation={0}
        sx={{
          borderRadius: 1,
          p: { xs: 2.5, sm: 4 },
          boxShadow: (t) =>
            t.palette.mode === 'light'
              ? `0 4px 20px ${alpha(t.palette.primary.main, 0.08)}`
              : `0 4px 20px ${alpha(t.palette.common.black, 0.25)}`,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
          验证设置
        </Typography>

        <Box sx={{ display: 'grid', gap: 3 }}>
          <FormControl fullWidth>
            <InputLabel>人机验证方式</InputLabel>
            <Select
              value={mode}
              label="人机验证方式"
              onChange={(e) => setMode(e.target.value as AuthSettings['verificationMode'])}
            >
              {MODE_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Alert severity={mode === 'none' ? 'warning' : 'info'} sx={{ borderRadius: 1 }}>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 0.25 }}>
              {current.label}
            </Typography>
            <Typography variant="body2">{current.desc}</Typography>
          </Alert>

          <Box sx={{ display: 'grid', gap: 1.5 }}>
            <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
              应用场景
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={loginVerification}
                  onChange={(e) => setLoginVerification(e.target.checked)}
                />
              }
              label="登录时启用验证"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={registerVerification}
                  onChange={(e) => setRegisterVerification(e.target.checked)}
                />
              }
              label="注册时启用验证（含发验证码）"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={forgotPasswordVerification}
                  onChange={(e) => setForgotPasswordVerification(e.target.checked)}
                />
              }
              label="忘记密码时启用验证（含发验证码）"
            />
          </Box>

          {mode === 'turnstile' && (
            <Box sx={{ display: 'grid', gap: 2.5 }}>
              <TextField
                label="Turnstile Site Key"
                value={turnstileSiteKey}
                onChange={(e) => setTurnstileSiteKey(e.target.value)}
                fullWidth
              />
              <TextField
                label="Turnstile Secret Key"
                type="password"
                value={turnstileSecret}
                onChange={(e) => setTurnstileSecret(e.target.value)}
                fullWidth
              />
            </Box>
          )}

          {mode === 'geetest' && (
            <Box sx={{ display: 'grid', gap: 2.5 }}>
              <TextField
                label="极验 Captcha ID"
                value={geetestCaptchaId}
                onChange={(e) => setGeetestCaptchaId(e.target.value)}
                fullWidth
              />
              <TextField
                label="极验 Captcha Key"
                type="password"
                value={geetestCaptchaKey}
                onChange={(e) => setGeetestCaptchaKey(e.target.value)}
                fullWidth
              />
            </Box>
          )}

          {mode === 'hcaptcha' && (
            <Box sx={{ display: 'grid', gap: 2.5 }}>
              <TextField
                label="hCaptcha Site Key"
                value={hcaptchaSiteKey}
                onChange={(e) => setHcaptchaSiteKey(e.target.value)}
                fullWidth
              />
              <TextField
                label="hCaptcha Secret Key"
                type="password"
                value={hcaptchaSecret}
                onChange={(e) => setHcaptchaSecret(e.target.value)}
                fullWidth
              />
            </Box>
          )}

        </Box>
        <FloatingSaveButton show={isDirty} saving={saving} onClick={handleSave} label="保存设置" />
      </Paper>
    </Fade>
  );
}
