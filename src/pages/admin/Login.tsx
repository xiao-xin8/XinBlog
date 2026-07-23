import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
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
  Grow,
  useTheme,
  Dialog,
  DialogContent,
  Slider,
  CircularProgress,
} from '@mui/material';
import { Visibility, VisibilityOff, Lock, Person, Email, VpnKey } from '@mui/icons-material';
import { useAuthStore } from '@/stores/authStore';
import { fetchAuthSettings } from '@/api/admin';
import { apiPost } from '@/api/client';

export function AdminLogin() {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, isAuthenticated } = useAuthStore();
  const [tab, setTab] = useState(0);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [allowRegister, setAllowRegister] = useState(true);
  const [emailVerification, setEmailVerification] = useState(false);
  const [captchaOpen, setCaptchaOpen] = useState(false);
  const [captchaValue, setCaptchaValue] = useState(0);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, from, navigate]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const settings = await fetchAuthSettings();
      if (cancelled) return;
      if (settings) {
        setAllowRegister(settings.allowRegister);
        setEmailVerification(settings.emailVerification);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setError('');
    setSuccess('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setEmail('');
    setCode('');
    setShowPassword(false);
  }, [tab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (tab === 1) {
        if (password !== confirmPassword) {
          setError('两次输入的密码不一致');
          setLoading(false);
          return;
        }
        const result = await register(username, password, email, emailVerification ? code : undefined);
        if (result.ok) {
          setSuccess('注册成功，请登录');
          setTab(0);
        } else {
          setError(result.msg || '注册失败');
        }
      } else {
        const result = await login(username, password);
        if (result.ok) {
          navigate(from, { replace: true });
        } else {
          setError(result.msg || '登录失败');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const openCaptcha = () => {
    if (!username) {
      setError('请先输入用户名');
      return;
    }
    if (!email) {
      setError('请先输入邮箱');
      return;
    }
    setError('');
    setSuccess('');
    setCaptchaValue(0);
    setCaptchaOpen(true);
  };

  const closeCaptcha = () => {
    setCaptchaOpen(false);
    setCaptchaValue(0);
  };

  const handleCaptchaChange = (_: React.SyntheticEvent | Event, value: number | number[]) => {
    setCaptchaValue(value as number);
  };

  const handleCaptchaCommit = async (_: React.SyntheticEvent | Event, value: number | number[]) => {
    if (value !== 100) return;
    setCaptchaOpen(false);
    await sendCode();
  };

  const sendCode = async () => {
    setSendingCode(true);
    setError('');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('请求超时')), 15000);
    try {
      const res = await apiPost('/api/v1/auth/verify-code', { username, email }, { signal: controller.signal });
      if (res.code !== 0) {
        setError(res.msg || '发送失败');
      } else {
        setSuccess('验证码已发送，请查收邮箱');
      }
    } finally {
      clearTimeout(timer);
      setSendingCode(false);
    }
  };

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

  return (
    <Fade in timeout={500}>
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
            登录
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 4 }}>
            {tab === 0 ? '欢迎回来，请登录您的账号' : '创建新账号，加入站点'}
          </Typography>

          {allowRegister ? (
            <Box
              sx={{
                position: 'relative',
                display: 'flex',
                mb: 3,
                p: 0.5,
                borderRadius: (theme) => theme.shape.borderRadius * 1.5,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: 4,
                  bottom: 4,
                  left: 4,
                  width: 'calc(50% - 4px)',
                  bgcolor: 'background.paper',
                  borderRadius: (theme) => theme.shape.borderRadius * 1.5,
                  boxShadow: (theme) => `0 2px 10px ${alpha(theme.palette.common.black, 0.08)}`,
                  transition: (theme) =>
                    theme.transitions.create('transform', {
                      easing: theme.transitions.easing.easeInOut,
                      duration: theme.transitions.duration.short,
                    }),
                  transform: tab === 0 ? 'translateX(0)' : 'translateX(100%)',
                }}
              />
              <Button
                onClick={() => setTab(0)}
                sx={{
                  flex: 1,
                  zIndex: 1,
                  py: 1,
                  borderRadius: (theme) => theme.shape.borderRadius * 1.5,
                  color: tab === 0 ? 'primary.main' : 'text.secondary',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  textTransform: 'none',
                  bgcolor: 'transparent',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: 'transparent' },
                }}
              >
                登录
              </Button>
              <Button
                onClick={() => setTab(1)}
                sx={{
                  flex: 1,
                  zIndex: 1,
                  py: 1,
                  borderRadius: (theme) => theme.shape.borderRadius * 1.5,
                  color: tab === 1 ? 'primary.main' : 'text.secondary',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  textTransform: 'none',
                  bgcolor: 'transparent',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: 'transparent' },
                }}
              >
                注册
              </Button>
            </Box>
          ) : (
            <Box sx={{ mb: 3, textAlign: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                登录
              </Typography>
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: (theme) => Math.max(8, theme.shape.borderRadius - 4) }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 3, borderRadius: (theme) => Math.max(8, theme.shape.borderRadius - 4) }}>
              {success}
            </Alert>
          )}

          <Fade in timeout={200} key={tab}>
            <Box
              component="form"
              onSubmit={handleSubmit}
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
              {tab === 1 && (
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
              )}
              {tab === 1 && emailVerification && (
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
                          onClick={openCaptcha}
                          disabled={sendingCode || !username || !email}
                          startIcon={sendingCode ? <CircularProgress size={14} color="inherit" /> : undefined}
                          sx={{ minWidth: 80, whiteSpace: 'nowrap' }}
                        >
                          {sendingCode ? '发送中' : '获取验证码'}
                        </Button>
                      </InputAdornment>
                    ),
                  }}
                />
              )}
              <TextField
                label="密码"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {tab === 1 && (
                <TextField
                  label="确认密码"
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
              )}
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
                {loading ? (tab === 0 ? '登录中...' : '注册中...') : tab === 0 ? '登录' : '注册'}
              </Button>
            </Box>
          </Fade>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Button
              component={Link}
              to="/"
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
              返回博客首页
            </Button>
          </Box>
        </Paper>

        <Dialog
          open={captchaOpen}
          onClose={closeCaptcha}
          TransitionComponent={Grow}
          BackdropProps={{ 'aria-hidden': false }}
          PaperProps={{
            sx: {
              borderRadius: 1,
              width: '100%',
              maxWidth: 360,
            },
          }}
        >
          <DialogContent sx={{ px: 3, py: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, textAlign: 'center' }}>
              安全验证
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
              请拖动滑块到最右侧以发送验证码
            </Typography>
            <Box
              sx={{
                position: 'relative',
                height: 48,
                bgcolor: (theme) =>
                  theme.palette.mode === 'light'
                    ? alpha(theme.palette.common.black, 0.04)
                    : alpha(theme.palette.common.white, 0.08),
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {captchaValue === 100 ? '验证通过' : '向右滑动验证'}
                </Typography>
              </Box>
              <Slider
                value={captchaValue}
                onChange={handleCaptchaChange}
                onChangeCommitted={handleCaptchaCommit}
                min={0}
                max={100}
                step={1}
                sx={{
                  position: 'absolute',
                  inset: 0,
                  m: 0,
                  height: 48,
                  padding: 0,
                  '& .MuiSlider-rail': {
                    height: 48,
                    opacity: 0,
                    borderRadius: 1,
                  },
                  '& .MuiSlider-track': {
                    height: 48,
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                    border: 'none',
                    borderRadius: 1,
                  },
                  '& .MuiSlider-thumb': {
                    width: 48,
                    height: 48,
                    borderRadius: 1,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&::before': { boxShadow: 'none' },
                    '&:hover, &.Mui-focusVisible': { boxShadow: 'none' },
                  },
                }}
              />
            </Box>
          </DialogContent>
        </Dialog>
      </Box>
    </Fade>
  );
}
