import { Box, Button, Paper, Typography, alpha, Fade } from '@mui/material';
import { Home, Lock, Login } from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export function AdminForbidden() {
  const navigate = useNavigate();
  const { logout, isAuthenticated } = useAuthStore();

  const handleSwitchAccount = () => {
    logout();
    navigate('/admin/login', { replace: true });
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
          p: { xs: 4, sm: 5 },
          borderRadius: 1,
          textAlign: 'center',
          boxShadow: (theme) =>
            theme.palette.mode === 'light'
              ? `0 8px 40px ${alpha(theme.palette.primary.main, 0.12)}`
              : `0 8px 40px ${alpha(theme.palette.common.black, 0.3)}`,
        }}
      >
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            mx: 'auto',
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: (theme) => alpha(theme.palette.error.main, 0.1),
            color: 'error.main',
          }}
        >
          <Lock sx={{ fontSize: 36 }} />
        </Box>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 1 }}>
          无权访问
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          当前账号没有管理后台访问权限。如需管理站点，请使用超级管理员账号登录。
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Button
            component={Link}
            to="/"
            variant="contained"
            startIcon={<Home />}
            fullWidth
            sx={{
              py: 1.2,
            borderRadius: (theme) => Math.max(8, theme.shape.borderRadius - 4),
            fontWeight: 700,
            background: (theme) => theme.palette.gradient.primary,
            }}
          >
            返回博客首页
          </Button>
          {isAuthenticated && (
            <Button
              variant="outlined"
              startIcon={<Login />}
              onClick={handleSwitchAccount}
              fullWidth
              sx={{ py: 1.2, borderRadius: (theme) => Math.max(8, theme.shape.borderRadius - 4), fontWeight: 600 }}
            >
              切换管理员账号
            </Button>
          )}
        </Box>
      </Paper>
    </Box>
    </Fade>
  );
}
