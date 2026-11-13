import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  alpha,
  Fade,
  useTheme,
  CircularProgress,
} from '@mui/material';
import { Visibility, VisibilityOff, Lock, Person, Email, VpnKey } from '@mui/icons-material';
import { useAuthStore } from '@/stores/authStore';
import { HumanCaptcha, type HumanCaptchaHandle } from '@/components/Common/HumanCaptcha';
import { fetchCaptchaConfig, type CaptchaPayload } from '@/api/captcha';

export function ForgotPassword() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { sendForgotCode, resetPassword, isAuthenticated } = useAuthStore();
  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [captchaMode, setCaptchaMode] = useState<'none' | 'turnstile' | 'math' | 'geetest' | 'hcaptcha'>('none');
  const [forgotRequired, setForgotRequired] = useState(false);
  const [captchaPayload, setCaptchaPayload] = useState<CaptchaPayload | null>(null);
  const captchaRef = useRef<HumanCaptchaHandle>(null);
  // 标记发了验证码但尚未通过验证，验证通过后自动补发
  const sendCodePendingRef = useRef(false);

  // 已登录用户无需找回密码，回首页
  if (isAuthenticated) {
    navigate('/', { replace: true });
  }

  const inputRippleSx = {
    '& .MuiOutlinedInput-root': {
      position: 'relative',
      overflow: 'hidden',
      borderRadius: Math.max(8, theme.shape.borderRadius - 4),
      '&::after': {
        content: '""',
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: 16,
        height: 16,
        borderRadius: '50%',
        backgroundColor: alpha(theme.palette.primary.main, 0.12),
        transform: 'translate(-50%, -50%) scale(0)',
        opacity: 0,
        transition: 'transform 0.45s ease-out, opacity 0.45s ease-out',
        pointerEvents: 'none',
      },
      '&.Mui-focused::after': {
        transform: 'translate(-50%, -50%) scale(35)',
        opacity: 1,
      },
    },
  };

  // 一进页面即获取验证开关与模式，决定是否需要内嵌人机验证
  useEffect(() => {
    let cancelled = false;
    fetchCaptchaConfig().then((cfg) => {
      if (cancelled || !cfg) return;
      setCaptchaMode(cfg.mode);
      setForgotRequired(cfg.forgotRequired);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSendCode = async (payload?: CaptchaPayload) => {
    setSendingCode(true);
    setError('');
    try {
      const result = await sendForgotCode(username, email, payload);
      if (result.debug) console.log('[forgot-code] 调试信息：', result.debug);
      if (result.ok) {
        setSuccess(result.msg || '验证码已发送，请查收邮箱');
        setStep(2);
      } else {
        setError(result.msg || '发送失败');
      }
    } finally {
      setSendingCode(false);
    }
  };

  // 忘记密码场景是否需要验证；验证区始终显示，成功后不卸载（让 Turnstile 自带成功状态可见）
  const requires = forgotRequired && captchaMode !== 'none';
  const showInlineCaptcha = requires;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword.length < 6) {
      setError('新密码至少 6 位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      const result = await resetPassword(username, email, code, newPassword);
      if (result.ok) {
        setSuccess(result.msg || '密码已重置，请使用新密码登录');
        setTimeout(() => navigate('/admin/login', { replace: true }), 1600);
      } else {
        setError(result.msg || '重置失败');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Fade in timeout={400}>
      <Box
        sx={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: (theme) => theme.palette.gradient.hero,
          p: { xs: 1.5, sm: 2 },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 420,
            p: { xs: 3, sm: 5 },
            borderRadius: 1,
            boxShadow: (theme) =>
              theme.palette.mode === 'light'
                ? `0 8px 40px ${alpha(theme.palette.primary.main, 0.12)}`
                : `0 8px 40px ${alpha(theme.palette.common.black, 0.3)}`,
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 800,
              textAlign: 'center',
              mb: 1,
              background: (theme) => theme.palette.gradient.primary,
              backgroundClip: 'text',
              textFillColor: 'transparent',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            找回密码
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 4 }}>
            {step === 1 ? '请输入用户名和邮箱获取重置验证码' : '输入验证码并设置新密码'}
          </Typography>

          {error && (
            <Fade in timeout={400}>
              <Alert severity="error" sx={{ mb: 3, borderRadius: (theme) => Math.max(8, theme.shape.borderRadius - 4) }}>
                {error}
              </Alert>
            </Fade>
          )}

          {success && (
            <Fade in timeout={400}>
              <Alert severity="success" sx={{ mb: 3, borderRadius: (theme) => Math.max(8, theme.shape.borderRadius - 4) }}>
                {success}
              </Alert>
            </Fade>
          )}

          {showInlineCaptcha && (
            <Box sx={{ mb: 3 }}>
              <HumanCaptcha
                ref={captchaRef}
                inline
                open
                onClose={() => {}}
                onSuccess={(p) => {
                  setCaptchaPayload(p);
                  if (sendCodePendingRef.current) {
                    sendCodePendingRef.current = false;
                    void handleSendCode(p);
                  }
                }}
              />
            </Box>
          )}

          <Fade in timeout={450} key={step}>
          {step === 1 ? (
            <Box
              component="form"
              onSubmit={(e) => {
                e.preventDefault();
                if (requires && !captchaPayload) {
                  sendCodePendingRef.current = true;
                  captchaRef.current?.trigger();
                  return;
                }
                void handleSendCode(captchaPayload ?? undefined);
              }}
              sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
            >
              <TextField
                label="用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                fullWidth
                required
                autoFocus
                variant="outlined"
                sx={inputRippleSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Person color="action" />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="邮箱"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                required
                variant="outlined"
                sx={inputRippleSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email color="action" />
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={sendingCode || !username || !email}
                startIcon={sendingCode ? <CircularProgress size={18} color="inherit" /> : undefined}
                sx={{
                  mt: 1,
                  py: 1.2,
                  borderRadius: (theme) => Math.max(8, theme.shape.borderRadius - 4),
                  background: (theme) => theme.palette.gradient.primary,
                  fontWeight: 700,
                  fontSize: '1rem',
                  color: 'primary.contrastText',
                  '&.Mui-disabled': {
                    background: (theme) => theme.palette.gradient.primary,
                    color: 'primary.contrastText',
                    opacity: 0.55,
                  },
                }}
              >
                {sendingCode ? '发送中...' : '获取验证码'}
              </Button>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleReset} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                label="邮箱验证码"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                fullWidth
                required
                variant="outlined"
                sx={inputRippleSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <VpnKey color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button
                        size="small"
                        onClick={() => void handleSendCode(captchaPayload ?? undefined)}
                        disabled={sendingCode || (requires && !captchaPayload)}
                        startIcon={sendingCode ? <CircularProgress size={14} color="inherit" /> : undefined}
                        sx={{ minWidth: 80, whiteSpace: 'nowrap' }}
                      >
                        重发
                      </Button>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="新密码"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                fullWidth
                required
                variant="outlined"
                sx={inputRippleSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        aria-label={showPassword ? '隐藏密码' : '显示密码'}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="确认新密码"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                fullWidth
                required
                variant="outlined"
                sx={inputRippleSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock color="action" />
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
                sx={{
                  mt: 1,
                  py: 1.2,
                  borderRadius: (theme) => Math.max(8, theme.shape.borderRadius - 4),
                  background: (theme) => theme.palette.gradient.primary,
                  fontWeight: 700,
                  fontSize: '1rem',
                  color: 'primary.contrastText',
                  '&.Mui-disabled': {
                    background: (theme) => theme.palette.gradient.primary,
                    color: 'primary.contrastText',
                    opacity: 0.55,
                  },
                }}
              >
                {loading ? '重置中...' : '重置密码'}
              </Button>
            </Box>
          )}
          </Fade>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Button
              component={Link}
              to="/admin/login"
              variant="outlined"
              size="large"
              fullWidth
              sx={{
                borderRadius: (theme) => Math.max(8, theme.shape.borderRadius - 4),
                py: 1,
                fontWeight: 600,
                textTransform: 'none',
              }}
            >
              返回登录
            </Button>
          </Box>
        </Paper>
      </Box>
    </Fade>
  );
}