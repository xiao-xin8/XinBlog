import { Box, CircularProgress, Typography, Fade } from '@mui/material';

interface LoadingProps {
  text?: string;
  fullScreen?: boolean;
}

export function Loading({ text = '加载中...', fullScreen = false }: LoadingProps) {
  return (
    <Fade in timeout={300}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: fullScreen ? '100dvh' : '30dvh',
          width: '100%',
          gap: 2,
        }}
      >
        <CircularProgress size={48} thickness={4} sx={{ color: 'primary.main' }} />
        <Typography color="text.secondary">{text}</Typography>
      </Box>
    </Fade>
  );
}

export function PageLoading() {
  return <Loading fullScreen text="页面加载中..." />;
}
