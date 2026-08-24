import { Box, Button, Typography, alpha, Divider } from '@mui/material';
import { ArrowBack, ArrowForward } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import type { Post } from '@/types';
import LikeButton from '@/components/Post/LikeButton';
import ShareButtons from '@/components/Post/ShareButtons';

interface PostDetailFooterProps {
  post: Post;
  siblings: Post[];
}

export function PostDetailFooter({ post, siblings }: PostDetailFooterProps) {
  const currentIndex = siblings.findIndex((p) => p.id === post.id);
  const prevPost = currentIndex > 0 ? siblings[currentIndex - 1] : undefined;
  const nextPost = currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : undefined;

  return (
    <Box sx={{ mt: { xs: 4, md: 6 } }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          mb: 4,
          flexWrap: { xs: 'wrap', sm: 'nowrap' },
        }}
      >
        <LikeButton slug={post.slug} />
        <ShareButtons title={post.title} />
      </Box>


      <Divider sx={{ my: 4, borderColor: (t) => alpha(t.palette.divider, 0.5) }} />

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 2,
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        {prevPost ? (
          <Button
            component={Link}
            to={`/post/${prevPost.slug}`}
            startIcon={<ArrowBack />}
            sx={{
              justifyContent: { xs: 'flex-start', sm: 'flex-start' },
              textAlign: 'left',
              flex: 1,
              py: 1.5,
              px: 2,
              borderRadius: 1,
              minHeight: { xs: 64, sm: 'auto' },
              bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'light' ? 0.06 : 0.08),
              color: 'text.primary',
              transition: 'all 0.3s ease',
              '&:hover': {
                bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'light' ? 0.12 : 0.15),
                transform: 'translateY(-2px)',
              },
              '&:active': { transform: 'scale(0.98)' },
            }}
          >
            <Box sx={{ width: '100%' }}>
              <Typography variant="caption" color="text.secondary" display="block">
                上一篇
              </Typography>

              <Typography
                variant="body2"
                fontWeight={700}
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: { xs: 2, sm: 1 },
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {prevPost.title}
              </Typography>

            </Box>

          </Button>

        ) : (
          <Box flex={1} />
        )}

        {nextPost ? (
          <Button
            component={Link}
            to={`/post/${nextPost.slug}`}
            endIcon={<ArrowForward />}
            sx={{
              justifyContent: { xs: 'flex-start', sm: 'flex-end' },
              textAlign: { xs: 'left', sm: 'right' },
              flex: 1,
              py: 1.5,
              px: 2,
              borderRadius: 1,
              minHeight: { xs: 64, sm: 'auto' },
              bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'light' ? 0.06 : 0.08),
              color: 'text.primary',
              transition: 'all 0.3s ease',
              '&:hover': {
                bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'light' ? 0.12 : 0.15),
                transform: 'translateY(-2px)',
              },
              '&:active': { transform: 'scale(0.98)' },
            }}
          >
            <Box sx={{ width: '100%' }}>
              <Typography variant="caption" color="text.secondary" display="block">
                下一篇
              </Typography>

              <Typography
                variant="body2"
                fontWeight={700}
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: { xs: 2, sm: 1 },
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {nextPost.title}
              </Typography>

            </Box>

          </Button>

        ) : (
          <Box flex={1} />
        )}
      </Box>

    </Box>

  );
}
