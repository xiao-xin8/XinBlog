import { Box, Typography, alpha } from '@mui/material';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import type { Post } from '@/types';
interface PostDetailRecentPostsProps {
  posts: Post[];
  currentSlug?: string;
  title?: string;
}
export function PostDetailRecentPosts({
  posts,
  currentSlug,
  title = 'RECOMMENDED',
}: PostDetailRecentPostsProps) {
  const recentPosts = posts.filter((p) => p.slug !== currentSlug).slice(0, 4);
  if (recentPosts.length === 0) return null;
  return (
    <Box
      sx={{
        p: 3,
        borderRadius: 1,
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
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 900,
          mb: 2,
          pl: 1.5,
          borderLeft: '4px solid',
          borderColor: 'primary.main',
          color: 'text.primary',
          letterSpacing: '0.05em',
        }}
      >
        {title}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {recentPosts.map((post) => (
          <Box
            key={post.id}
            component={Link}
            to={`/post/${post.slug}`}
            sx={{
              display: 'block',
              textDecoration: 'none',
              color: 'text.primary',
              transition: 'all 0.3s ease',
              '&:hover': {
                color: 'primary.main',
                transform: 'translateX(4px)',
              },
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                lineHeight: 1.5,
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {post.title}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                mt: 0.5,
                color: 'text.disabled',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              {dayjs(post.createdAt).format('YYYY-MM-DD')}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}