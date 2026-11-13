import { Box, Typography, alpha } from '@mui/material';
import { useSiteStore } from '@/stores/siteStore';

export function PostDetailAuthorCard() {
  const { config } = useSiteStore();
  const authorName = config.author || 'Xin';
  const avatar = config.logo || '';
  const bio = config.shareDescription || '记录生活、设计与技术感悟的个人博客';

  return (
    <Box
      sx={{
        p: 3,
        borderRadius: 1,
        textAlign: 'center',
        bgcolor: (t) =>
          t.palette.mode === 'light' ? 'rgba(255,255,255,0.6)' : 'rgba(30,41,59,0.5)',
        backdropFilter: 'blur(16px)',
        border: (t) => `1px solid ${alpha(t.palette.divider, 0.5)}`,
        boxShadow: (t) =>
          t.palette.mode === 'light'
            ? '0 10px 30px rgba(0,0,0,0.06)'
            : '0 10px 30px rgba(0,0,0,0.2)',
        transition: 'box-shadow 0.35s ease',
        '@media (hover: hover) and (pointer: fine)': {
          '&:hover': {
            boxShadow: (t) =>
              t.palette.mode === 'light'
                ? '0 16px 40px rgba(0,0,0,0.1)'
                : '0 16px 40px rgba(0,0,0,0.35)',
          },
        },
      }}
    >
      <Box
        sx={{
          width: 80,
          height: 80,
          mx: 'auto',
          mb: 2,
          p: 0.5,
          borderRadius: '50%',
          background: (t) => `linear-gradient(135deg, ${t.palette.primary.main} 0%, ${t.palette.secondary.main} 100%)`,
          boxShadow: (t) => `0 4px 15px ${alpha(t.palette.primary.main, 0.3)}`,
          transition: 'transform 0.5s ease',
          '&:hover': { transform: 'rotate(3deg) scale(1.02)' },
        }}
      >
        <Box
          component="img"
          src={avatar || '/logo.png'}
          alt={authorName}
          sx={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            objectFit: 'cover',
            bgcolor: 'background.paper',
          }}
        />
      </Box>

      <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', mb: 1 }}>
        {authorName}
      </Typography>

      <Typography
        variant="caption"
        sx={{
          display: 'block',
          color: 'text.secondary',
          lineHeight: 1.6,
          fontWeight: 500,
          mb: 2,
        }}
      >
        {bio}
      </Typography>
    </Box>
  );
}
