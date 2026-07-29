import { Box, Typography, alpha } from '@mui/material';
import dayjs from 'dayjs';
import type { Post } from '@/types';
import { PostDetailBackButton } from './PostDetailBackButton';
interface PostDetailHeaderProps {
  post: Post;
  showBackButton?: boolean;
  titleColor?: string;
}
export function PostDetailHeader({ post, showBackButton = true, titleColor }: PostDetailHeaderProps) {
  return (
    <Box component="header" sx={{ mb: { xs: 3, md: 4 } }}>
      {showBackButton && <PostDetailBackButton />}
      {post.cover && (
        <Box
          sx={{
            width: '100%',
            aspectRatio: '16 / 9',
            borderRadius: 1,
            overflow: 'hidden',
            mb: { xs: 3, md: 4 },
            position: 'relative',
            bgcolor: 'action.hover',
            '& img': {
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.9,
              transition: 'transform 1s ease',
            },
            '&:hover img': {
              transform: 'scale(1.05)',
            },
          }}
        >
          <Box component="img" src={post.cover} alt={post.title} loading="eager" />
        </Box>
      )}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1.5,
          mb: 2,
        }}
      >
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            px: { xs: 1.5, md: 2 },
            py: { xs: 0.75, md: 1 },
            borderRadius: '999px',
            fontSize: { xs: '0.75rem', md: '0.875rem' },
            fontWeight: 700,
            color: 'primary.main',
            bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'light' ? 0.08 : 0.15),
            border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.12)}`,
          }}
        >
          <Box
            component="svg"
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </Box>
          写作时间：{dayjs(post.createdAt).format('YYYY-MM-DD')}
        </Box>
        {post.tags.map((tag) => (
          <Box
            key={tag.id}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: { xs: 1.5, md: 2 },
              py: { xs: 0.75, md: 1 },
              borderRadius: '999px',
              fontSize: { xs: '0.75rem', md: '0.875rem' },
              fontWeight: 700,
              color: 'secondary.main',
              bgcolor: (t) => alpha(t.palette.secondary.main, t.palette.mode === 'light' ? 0.08 : 0.15),
              border: (t) => `1px solid ${alpha(t.palette.secondary.main, 0.12)}`,
            }}
          >
            <Typography component="span" sx={{ fontSize: 'inherit', opacity: 0.7 }}>
              #
            </Typography>
            {tag.name}
          </Box>
        ))}
      </Box>
      <Typography
        variant="h1"
        sx={{
          fontSize: { xs: '1.75rem', md: '2.5rem', lg: '3rem' },
          fontWeight: 800,
          lineHeight: 1.2,
          color: titleColor || 'text.primary',
          mb: 2,
          letterSpacing: '-0.02em',
          overflowWrap: 'break-word',
          pr: showBackButton ? { xs: 0, md: 6 } : 0,
        }}
      >
        {post.title}
      </Typography>
    </Box>
  );
}