import { Container, Typography, Button, Fade } from '@mui/material';
import { Home } from '@mui/icons-material';
import { Link } from 'react-router-dom';
export function NotFound() {
  return (
    <Fade in timeout={500}>
      <Container maxWidth="sm" sx={{ py: 12, textAlign: 'center' }}>
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: 100, md: 150 },
            fontWeight: 800,
            background: (theme) => theme.palette.gradient.primary,
            backgroundClip: 'text',
            textFillColor: 'transparent',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1,
            mb: 2,
          }}
        >
          404
        </Typography>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 2 }}>
          页面未找到
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          你访问的页面不存在，也许它去了远方。
        </Typography>
        <Button
          component={Link}
          to="/"
          variant="contained"
          startIcon={<Home />}
          sx={{
            px: 4,
            py: 1.2,
            borderRadius: 1,
            background: (theme) => theme.palette.gradient.primary,
          }}
        >
          返回首页
        </Button>
      </Container>
    </Fade>
  );
}