import { Box, Typography } from '@mui/material';
import { Logo } from '@/components/Common/Logo';
import type { NavThemeConfig } from '@/types';
interface NavLogoProps {
  navTheme: NavThemeConfig;
}
export function NavLogo({ navTheme }: NavLogoProps) {
  const logoText = navTheme.logoText ?? '';
  const activeColor = navTheme.activeColor || 'primary.main';
  if (!logoText) {
    return <Logo />;
  }
  return (
    <Box
      component="a"
      href="/"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        textDecoration: 'none',
        color: navTheme.textColor || 'text.primary',
        typography: 'h6',
        fontWeight: 900,
        letterSpacing: '-0.02em',
        '&:hover': {
          color: activeColor,
        },
        transition: (theme) =>
          theme.transitions.create('color', {
            easing: theme.transitions.easing.easeInOut,
            duration: theme.transitions.duration.short,
          }),
      }}
    >
      <Typography component="span" sx={{ fontWeight: 900, fontSize: 'inherit', color: 'inherit' }}>
        {logoText}
      </Typography>
    </Box>
  );
}