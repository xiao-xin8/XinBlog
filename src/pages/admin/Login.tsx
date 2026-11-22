import { useState, useEffect, useRef } from 'react';
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
  useTheme,
  CircularProgress,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { Visibility, VisibilityOff, Lock, Person, Email, VpnKey } from '@mui/icons-material';
import { useAuthStore } from '@/stores/authStore';
import { fetchAuthSettings } from '@/api/admin';
import { apiPost } from '@/api/client';
import { HumanCaptcha, type HumanCaptchaHandle } from '@/components/Common/HumanCaptcha';
import { fetchCaptchaConfig, type CaptchaPayload } from '@/api/captcha';

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
  const [enableForgot, setEnableForgot] = useState(false);
  const [captchaMode, setCaptchaMode] = useState<'none' | 'turnstile' | 'math' | 'geetest' | 'hcaptcha'>('none');
  const [loginRequired, setLoginRequired] = useState(false);
  const [registerRequired, setRegisterRequired] = useState(false);
  const [captchaPayload, setCaptchaPayload] = useState<CaptchaPayload | null>(null);
  const [agreed, setAgreed] = useState(false);
  const captchaRef = useRef<HumanCaptchaHandle>(null);
  // 标记用户点击了"发送验证码"但尚未通过验证，验证通过后自动补发
  const sendCodePendingRef = useRef(false);
  // 标记用户点击了"注册"但尚未通过验证，验证通过后自动提交注册
  const registerPendingRef = useRef(false);
  // 标记当前 captchaPayload 已被发码接口消费（一次性 token）。注册不再重复验证，
  // 只有「关闭邮箱验证」导致没有发码环节时，才需要重新取一次
  const captchaConsumedRef = useRef(false);
  // 同步持有最新验证负载：验证成功后 setState 是异步的，自动提交注册时需要从 ref 读到刚拿到的新 token
  const captchaPayloadRef = useRef<CaptchaPayload | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

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
      const cfg = await fetchCaptchaConfig();
      if (cancelled) return;
      if (settings) {
        setAllowRegister(settings.allowRegister);
        setEmailVerification(settings.emailVerification);
        setEnableForgot(settings.enableForgotPassword);
      }
      if (cfg) {
        setCaptchaMode(cfg.mode);
        setLoginRequired(cfg.loginRequired);
        setRegisterRequired(cfg.registerRequired);
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
    setAgreed(false);
    // 切换登录/注册页时清空验证状态：旧 token 可能已被消费或不适用于新场景
    setCaptchaPayload(null);
    captchaPayloadRef.current = null;
    captchaConsumedRef.current = false;
    sendCodePendingRef.current = false;
    registerPendingRef.current = false;
  }, [tab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (tab === 1) {
        if (/[\u4e00-\u9fa5]/.test(username)) {
          setError('用户名不能包含中文');
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError('两次输入的密码不一致');
          setLoading(false);
          return;
        }
        // 人机验证已经在「发送验证码」时通过（token 一次性，发码即消费，无法复用），
        // 这里不再重复弹。只有关掉邮箱验证、没有发码环节时，才在注册处补一次校验。
        const activeCaptcha = captchaPayloadRef.current ?? captchaPayload;
        const needCaptchaHere = registerRequired && captchaMode !== 'none' && !emailVerification;
        if (needCaptchaHere && (!activeCaptcha || captchaConsumedRef.current)) {
          registerPendingRef.current = true;
          // 极验为弹窗式，用 trigger 重新弹出；其它模式需销毁旧控件重建（拿到新 token）
          if (captchaMode === 'geetest') {
            captchaRef.current?.trigger();
          } else {
            captchaRef.current?.reset();
          }
          setLoading(false);
          return;
        }
        const result = await register(
          username,
          password,
          email,
          emailVerification ? code : undefined,
          activeCaptcha ?? undefined
        );
        if (result.ok) {
          setSuccess('注册成功，请登录');
          setTab(0);
        } else {
          setError(result.msg || '注册失败');
        }
      } else {
        const result = await login(username, password, undefined, captchaPayloadRef.current ?? captchaPayload ?? undefined);
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

  // 当前场景是否需要验证（需在发送/提交前完成）
  const requiresLogin = loginRequired && captchaMode !== 'none';
  const requiresRegister = registerRequired && captchaMode !== 'none';
  const requiresCurrent = tab === 0 ? requiresLogin : requiresRegister;
  // 内嵌验证：验证区始终显示，成功后不卸载（让 Turnstile 自带成功状态可见）
  const showInlineCaptcha = requiresCurrent;

  const sendCode = async (payload?: CaptchaPayload) => {
    setSendingCode(true);
    setError('');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('请求超时')), 15000);
    try {
      const res = await apiPost('/api/v1/auth/verify-code', { username, email, ...(payload || {}) }, { signal: controller.signal });
      if (res.code !== 0) {
        setError(res.msg || '发送失败');
      } else {
        setSuccess('验证码已发送，请查收邮箱');
        // 发码接口已消费人机验证 token（turnstile/hcaptcha/geetest 一次性，math 有时效），标记作废
        captchaConsumedRef.current = true;
      }
    } finally {
      clearTimeout(timer);
      setSendingCode(false);
    }
  };

  // 发送验证码：若注册需验证但尚未通过（或上次 token 已被发码消费），先重新验证，通过后自动补发
  const handleSendCode = () => {
    if (requiresRegister && (!captchaPayload || captchaConsumedRef.current)) {
      sendCodePendingRef.current = true;
      // 极验为弹窗式，用 trigger 重新弹出；其它模式需销毁旧控件重建（拿到新 token）
      if (captchaMode === 'geetest') {
        captchaRef.current?.trigger();
      } else {
        captchaRef.current?.reset();
      }
      return;
    }
    void sendCode(captchaPayload ?? undefined);
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
              ref={formRef}
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
                        onClick={handleSendCode}
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
              {showInlineCaptcha && (
                <HumanCaptcha
                  ref={captchaRef}
                  inline
                  open
                  onClose={() => {}}
                  onSuccess={(p) => {
                    setCaptchaPayload(p);
                    captchaPayloadRef.current = p;
                    captchaConsumedRef.current = false;
                    if (sendCodePendingRef.current) {
                      sendCodePendingRef.current = false;
                      void sendCode(p);
                    } else if (registerPendingRef.current) {
                      registerPendingRef.current = false;
                      formRef.current?.requestSubmit();
                    }
                  }}
                />
              )}
              {tab === 1 && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      size="small"
                      sx={{
                        color: (theme) => alpha(theme.palette.primary.main, 0.4),
                        '&.Mui-checked': {
                          color: 'primary.main',
                        },
                      }}
                    />
                  }
                  label={
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.85rem' } }}>
                      我已阅读并同意{' '}
                      <Typography
                        component={Link}
                        to="/agreement"
                        target="_blank"
                        variant="body2"
                        sx={{
                          color: 'primary.main',
                          textDecoration: 'underline',
                          fontWeight: 500,
                          fontSize: 'inherit',
                          '&:hover': { opacity: 0.8 },
                        }}
                      >
                        用户协议
                      </Typography>
                      {' 和 '}
                      <Typography
                        component={Link}
                        to="/privacy"
                        target="_blank"
                        variant="body2"
                        sx={{
                          color: 'primary.main',
                          textDecoration: 'underline',
                          fontWeight: 500,
                          fontSize: 'inherit',
                          '&:hover': { opacity: 0.8 },
                        }}
                      >
                        隐私政策
                      </Typography>
                    </Typography>
                  }
                  sx={{ m: 0 }}
                />
              )}
              {tab === 0 && enableForgot && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -1 }}>
                  <Typography
                    component={Link}
                    to="/forgot-password"
                    variant="body2"
                    sx={{
                      color: 'primary.main',
                      fontWeight: 500,
                      textDecoration: 'none',
                      '&:hover': { opacity: 0.75, textDecoration: 'underline' },
                    }}
                  >
                    忘记密码？
                  </Typography>
                </Box>
              )}
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={loading || (requiresCurrent && !captchaPayload) || (tab === 1 && !agreed)}
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
      </Box>
    </Fade>
  );
}
