import { useState } from 'react';
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
  Grow,
  useTheme,
  Dialog,
  DialogContent,
  Slider,
  CircularProgress,
} from '@mui/material';
import { Visibility, VisibilityOff, Lock, Person, Email, VpnKey } from '@mui/icons-material';
import { useAuthStore } from '@/stores/authStore';

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
  const [captchaOpen, setCaptchaOpen] = useState(false);
  const [captchaValue, setCaptchaValue] = useState(0);

  
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

  const openCaptcha = () => {
    if (!username) {
      setError('请先输入用户名');
      return;
    }
    if (/[\u4e00-\u9fa5]/.test(username)) {
      setError('用户名不能包含中文');
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
    await handleSendCode();
  };

  const handleSendCode = async () => {
    setSendingCode(true);
    setError('');
    try {
      const result = await sendForgotCode(username, email);
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
        setTimeout(() => navigate('/login', { replace: true }), 1600);
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

          <Fade in timeout={450} key={step}>
          {step === 1 ? (
            <Box component="form" onSubmit={(e) => { e.preventDefault(); openCaptcha(); }} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
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
                onClick={openCaptcha}
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
                        onClick={openCaptcha}
                        disabled={sendingCode}
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
              to="/login"
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


        <Dialog
          open={captchaOpen}
          onClose={closeCaptcha}
          TransitionComponent={Grow}
          BackdropProps={{ 'aria-hidden': false }}
          PaperProps={{ sx: { borderRadius: 1, width: '100%', maxWidth: 360 } }}
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
                  '& .MuiSlider-rail': { height: 48, opacity: 0, borderRadius: 1 },
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