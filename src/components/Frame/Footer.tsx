import { Box, Typography, Container, alpha, Fade } from '@mui/material';
import { useSiteStore } from '@/stores/siteStore';
import { APP_VERSION, SITE_NAME, SITE_HOMEPAGE_URL } from '@/config';

export function Footer() {
  const { config } = useSiteStore();

  return (
    <Fade in timeout={400}>
      <Box
        component="footer"
        sx={{
          py: 4,
          mt: 'auto',
          borderTop: '1px solid',
          borderColor: 'divider',
          backgroundColor: (theme) =>
            theme.palette.mode === 'light'
              ? alpha(theme.palette.primary.main, 0.02)
              : alpha(theme.palette.common.black, 0.2),
        }}
      >
        <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            textAlign: 'center',
          }}
        >
          {config.footerText ? (
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'break-word', maxWidth: '100%' }}>
              {config.footerText}
            </Typography>
          ) : null}
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'break-word', maxWidth: '100%' }}>
            © {new Date().getFullYear()} {APP_VERSION} Powered by{' '}
            <Box
              component="a"
              href={SITE_HOMEPAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: (theme) => alpha(theme.palette.primary.main, 0.8),
                textDecoration: 'none',
                fontStyle: 'italic',
                '&:hover': {
                  color: (theme) => theme.palette.primary.main,
                },
              }}
            >
              {SITE_NAME}
            </Box>
          </Typography>
        </Box>
      </Container>
    </Box>
    </Fade>
  );
}
