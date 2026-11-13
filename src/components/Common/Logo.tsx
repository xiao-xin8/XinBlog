import { Box, Typography, alpha } from '@mui/material';
import { useSiteStore } from '@/stores/siteStore';

interface LogoProps {
  collapsed?: boolean;
}

export function Logo({ collapsed = false }: LogoProps) {
  const { config } = useSiteStore();
  const logoUrl = config.logo || '/logo.png';
  const siteName = config.siteName || 'XinBlog';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 1.5, minWidth: 0, maxWidth: '100%' }}>
      <Box
        component="img"
        src={logoUrl}
        alt={siteName}
        sx={{
          width: collapsed ? 36 : 40,
          height: collapsed ? 36 : 40,
          borderRadius: '10px',
          objectFit: 'cover',
          boxShadow: (theme) => `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
        }}
      />
      {!collapsed && (
        <Typography
          variant="h6"
          noWrap
          sx={{
            fontWeight: 700,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            background: (theme) => theme.palette.gradient.primary,
            backgroundClip: 'text',
            textFillColor: 'transparent',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {siteName}
        </Typography>
      )}
    </Box>
  );
}
