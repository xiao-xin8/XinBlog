import { useEffect, useState } from 'react';
import { Box, Button, Typography, alpha, keyframes } from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { useSnackbar } from 'notistack';
import { getLikes, createLike, deleteLike } from '@/api/likes';
import { getInteractionSettings } from '@/api/interaction';
import { useAuthStore } from '@/stores/authStore';
import type { LikeStatus } from '@/types/interaction';
interface LikeButtonProps {
  slug: string;
}
const pop = keyframes`
  0% { transform: scale(1); }
  40% { transform: scale(1.35); }
  70% { transform: scale(0.92); }
  100% { transform: scale(1); }
`;
export default function LikeButton({ slug }: LikeButtonProps) {
  const { isAuthenticated } = useAuthStore();
  const { enqueueSnackbar } = useSnackbar();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [status, setStatus] = useState<LikeStatus>({ count: 0, liked: false });
  const [loading, setLoading] = useState(false);
  const [popping, setPopping] = useState(false);
  useEffect(() => {
    let mounted = true;
    getInteractionSettings().then((res) => {
      if (mounted && res.code === 0 && res.data) {
        setEnabled(res.data.likesEnabled);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (enabled === false) return;
    let mounted = true;
    getLikes(slug).then((res) => {
      if (mounted && res.code === 0 && res.data) {
        setStatus(res.data);
      }
    });
    return () => {
      mounted = false;
    };
  }, [slug, enabled]);
  if (enabled === false) return null;
  const handleToggle = async () => {
    if (!isAuthenticated) {
      enqueueSnackbar('登录后才可以点赞哦', { variant: 'info' });
      return;
    }
    if (loading) return;
    setLoading(true);
    try {
      if (status.liked) {
        const res = await deleteLike(slug);
        if (res.code === 0) {
          setStatus((prev) => ({ count: Math.max(0, prev.count - 1), liked: false }));
        } else {
          enqueueSnackbar(res.msg || '取消点赞失败', { variant: 'error' });
        }
      } else {
        const res = await createLike(slug);
        if (res.code === 0) {
          setStatus((prev) => ({ count: prev.count + 1, liked: true }));
          setPopping(true);
          setTimeout(() => setPopping(false), 420);
          enqueueSnackbar('点赞完成', { variant: 'success' });
        } else {
          enqueueSnackbar(res.msg || '点赞失败', { variant: 'error' });
        }
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button
      onClick={handleToggle}
      disabled={loading}
      disableRipple={false}
      sx={{
        minWidth: 96,
        px: 2.5,
        py: 1,
        borderRadius: '999px',
        textTransform: 'none',
        fontWeight: 600,
        gap: 1,
        border: (theme) => `1.5px solid ${status.liked ? 'transparent' : alpha(theme.palette.text.secondary, 0.25)}`,
        color: status.liked ? '#fff' : 'text.secondary',
        background: status.liked
          ? (theme) => `linear-gradient(135deg, ${theme.palette.error.main} 0%, ${theme.palette.error.light} 100%)`
          : 'transparent',
        boxShadow: status.liked
          ? (theme) => `0 6px 18px ${alpha(theme.palette.error.main, 0.32)}`
          : 'none',
        transition: 'all 0.25s ease',
        '&:hover': {
          background: status.liked
            ? (theme) => `linear-gradient(135deg, ${theme.palette.error.dark} 0%, ${theme.palette.error.main} 100%)`
            : (theme) => alpha(theme.palette.error.main, 0.08),
          borderColor: status.liked ? 'transparent' : (theme) => alpha(theme.palette.error.main, 0.45),
          color: status.liked ? '#fff' : 'error.main',
        },
        '&:active': {
          transform: 'scale(0.96)',
        },
      }}
      aria-label={status.liked ? '取消点赞' : '点赞'}
    >
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: popping ? `${pop} 0.42s ease` : 'none',
        }}
      >
        <FavoriteIcon
          sx={{
            fontSize: 20,
            color: status.liked ? 'inherit' : 'error.main',
          }}
        />
      </Box>
      <Typography
        component="span"
        variant="body2"
        sx={{
          fontWeight: 700,
          color: 'inherit',
          minWidth: 14,
        }}
      >
        {status.count}
      </Typography>
      <Typography
        component="span"
        variant="body2"
        sx={{
          fontWeight: 600,
          color: 'inherit',
          opacity: 0.9,
        }}
      >
        {loading ? '点赞中' : '赞'}
      </Typography>
    </Button>
  );
}