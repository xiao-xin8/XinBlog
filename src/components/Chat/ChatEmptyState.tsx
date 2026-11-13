import { Box, Button, Typography, alpha, Fade } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Link } from 'react-router-dom';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';

/**
 * 公共聊天房关闭时的空态提示。
 * 不发起 WebSocket 连接、不渲染报错，仅展示友好提示。
 */
interface ChatEmptyStateProps {
  title?: string;
  description?: string;
  showBackHome?: boolean;
}

export default function ChatEmptyState({
  title = '公共聊天房暂未开放',
  description = '管理员正在整理房间，请稍后再来看看~',
  showBackHome = true,
}: ChatEmptyStateProps) {
  const theme = useTheme();
  const radius = Math.max(8, theme.shape.borderRadius - 4);

  return (
    <Fade in timeout={400}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          py: { xs: 8, sm: 12 },
          px: 3,
          borderRadius: `${radius}px`,
          border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.12)}`,
          background: (t) =>
            `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.06)}, ${alpha(
              t.palette.secondary.main,
              0.04
            )})`,
        }}
      >
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
            color: 'primary.main',
            mb: 2.5,
          }}
        >
          <ForumOutlinedIcon sx={{ fontSize: 36 }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
          {description}
        </Typography>
        {showBackHome && (
          <Button
            component={Link}
            to="/"
            variant="outlined"
            sx={{
              mt: 3,
              borderRadius: (t) => `max(8px, ${t.shape.borderRadius}px - 4px)`,
              px: 3,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            返回首页
          </Button>
        )}
      </Box>
    </Fade>
  );
}