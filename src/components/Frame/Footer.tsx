import { Box, Typography, Container, alpha, Fade, Divider } from '@mui/material';
import { Link } from 'react-router-dom';
import { useSiteStore } from '@/stores/siteStore';
import { resolveSpacingConfig } from '@/utils/spacingConfig';
import { APP_VERSION, SITE_NAME, SITE_HOMEPAGE_URL } from '@/config';

export function Footer() {
  const { config } = useSiteStore();
  const spacing = resolveSpacingConfig(config.spacing);

  return (
    <Fade in timeout={400}>
      <Box
        component="footer"
        sx={{
          py: { xs: `${spacing.footerPaddingY.mobile}px`, md: `${spacing.footerPaddingY.desktop}px` },
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
{(siteConfig.icpBeian || siteConfig.policeBeian) ? (
  <Typography variant="body2" sx={{ /* 保持原有样式 */ }}>
    {siteConfig.icpBeian && (
      <>
        <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">
          {siteConfig.icpBeian}
        </a>
        {' '}
      </>
    )}
    {siteConfig.policeBeian && (
      <a href={`https://beian.gov.cn/portal/registerSystemInfo?recordcode=${siteConfig.policeBeian.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
        <img src="https://beian.gov.cn/img/new/gongan.png" alt="" style={{ width: 14, height: 14, verticalAlign: 'middle', marginRight: 4 }} />
        {siteConfig.policeBeian}
      </a>
    )}
  </Typography>
) : (
  // ⬇️ 这里放你原来搜到的那行版权内容作为回退
  <Typography>© {new Date().getFullYear()} {siteConfig.siteName}</Typography>
)}
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
          <Divider sx={{ width: '100%', my: 1, opacity: 0.5 }} />
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: { xs: `${spacing.footerLinkGap.mobile}px`, md: `${spacing.footerLinkGap.desktop}px` },
              flexWrap: 'wrap',
            }}
          >
            <Typography
              component={Link}
              to="/agreement"
              variant="caption"
              sx={{
                color: (theme) => alpha(theme.palette.primary.main, 0.7),
                textDecoration: 'none',
                transition: 'color 0.2s ease',
                '&:hover': {
                  color: (theme) => theme.palette.primary.main,
                  textDecoration: 'underline',
                },
              }}
            >
              用户协议
            </Typography>
            <Typography
              component={Link}
              to="/privacy"
              variant="caption"
              sx={{
                color: (theme) => alpha(theme.palette.primary.main, 0.7),
                textDecoration: 'none',
                transition: 'color 0.2s ease',
                '&:hover': {
                  color: (theme) => theme.palette.primary.main,
                  textDecoration: 'underline',
                },
              }}
            >
              隐私政策
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
    </Fade>
  );
}
