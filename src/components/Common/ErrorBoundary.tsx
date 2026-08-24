import { Component, type ReactNode } from 'react';
import { Container, Typography, Button, Fade, Box, alpha } from '@mui/material';
import { Refresh, Home, SentimentDissatisfied } from '@mui/icons-material';
import { Link } from 'react-router-dom';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onReload={this.handleReload} />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error?: Error;
  onReload: () => void;
}

export function ErrorFallback({ error, onReload }: ErrorFallbackProps) {
  return (
    <Fade in timeout={400}>
      <Container
        maxWidth="sm"
        sx={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 6,
          textAlign: 'center',
        }}
      >
        <Box>
          <Box
            sx={{
              width: { xs: 96, md: 120 },
              height: { xs: 96, md: 120 },
              mx: 'auto',
              mb: 3,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: (theme) =>
                `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${alpha(
                  theme.palette.secondary.main,
                  0.15
                )} 100%)`,
              color: 'primary.main',
            }}
          >
            <SentimentDissatisfied sx={{ fontSize: { xs: 52, md: 64 } }} />
          </Box>


          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: 64, md: 80 },
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
            Oops
          </Typography>


          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 2 }}>
            页面出了点小问题
          </Typography>


          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 420, mx: 'auto' }}>
            应用遇到了意外错误，就像笔尖突然断墨。你可以刷新页面再试一次，或者返回首页重新开始。
          </Typography>


          {error && (
            <Typography
              variant="caption"
              component="pre"
              color="text.secondary"
              sx={{
                display: 'block',
                mb: 4,
                p: 2,
                borderRadius: 1,
                bgcolor: 'background.default',
                textAlign: 'left',
                overflow: 'auto',
                maxHeight: 120,
                fontFamily: '"Fira Code", monospace',
              }}
            >
              {error.message}
            </Typography>

          )}

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<Refresh />}
              onClick={onReload}
              sx={{
                px: 4,
                py: 1.2,
                borderRadius: 1,
                background: (theme) => theme.palette.gradient.primary,
              }}
            >
              刷新页面
            </Button>

            <Button
              component={Link}
              to="/"
              variant="outlined"
              startIcon={<Home />}
              sx={{
                px: 4,
                py: 1.2,
                borderRadius: 1,
              }}
            >
              返回首页
            </Button>

          </Box>

        </Box>

      </Container>

    </Fade>

  );
}
