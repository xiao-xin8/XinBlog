import { IconButton, Tooltip, alpha } from '@mui/material';
import { DarkMode, LightMode } from '@mui/icons-material';
import { useThemeStore } from '@/stores/themeStore';
export function ThemeToggle() {
  const { mode, toggleMode } = useThemeStore();
  return (
    <Tooltip title={mode === 'light' ? '切换暗色模式' : '切换亮色模式'}>
      <IconButton
        onClick={toggleMode}
        aria-label={mode === 'light' ? '切换暗色模式' : '切换亮色模式'}
        className="live2d-tip-theme"
        sx={{
          width: { xs: 44, sm: 40 },
          height: { xs: 44, sm: 40 },
          borderRadius: 1,
          backgroundColor: (theme) =>
            alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.08 : 0.1),
          color: 'text.primary',
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: (theme) =>
              alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.15 : 0.18),
            transform: 'scale(0.95)',
          },
        }}
      >
        {mode === 'light' ? <DarkMode sx={{ fontSize: 20 }} /> : <LightMode sx={{ fontSize: 20 }} />}
      </IconButton>
    </Tooltip>
  );
}