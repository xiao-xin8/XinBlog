import { Box, Typography, Avatar, alpha, Fade } from '@mui/material';
import { AccessTime, Visibility } from '@mui/icons-material';
import dayjs from 'dayjs';
import type { Post } from '@/types';
import { TagChip } from '@/components/Common/TagChip';
import { useSiteStore } from '@/stores/siteStore';

interface PostHeaderProps {
  post: Post;
}

export function PostHeader({ post }: PostHeaderProps) {
  const { config } = useSiteStore();
  const authorName = config.author || post.author || '';
  const authorAvatar = config.logo || '';

  return (
    <Fade in timeout={400}>
      <Box sx={{ mb: 4 }}>
        {post.cover && (
        <Box
          component="img"
          src={post.cover}
          alt={post.title}
          sx={{
            width: '100%',
            height: { xs: 220, md: 400 },
            objectFit: 'cover',
            borderRadius: 1,
            mb: 4,
            boxShadow: (theme) =>
              theme.palette.mode === 'light'
                ? `0 8px 32px ${alpha(theme.palette.primary.main, 0.12)}`
                : `0 8px 32px ${alpha(theme.palette.common.black, 0.3)}`,
          }}
        />
      )}

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3, minWidth: 0 }}>
        {post.tags.map((tag) => (
          <TagChip key={tag.id} tag={tag} />
        ))}
      </Box>


      <Typography
        variant="h2"
        component="h1"
        sx={{ fontWeight: 800, mb: 3, lineHeight: 1.2, fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3.75rem' }, overflowWrap: 'break-word' }}
      >
        {post.title}
      </Typography>


      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: { xs: 2, sm: 3 },
          color: 'text.secondary',
          minWidth: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          {authorAvatar ? (
            <Avatar
              src={authorAvatar}
              alt={authorName}
              sx={{
                width: 36,
                height: 36,
                background: (theme) => theme.palette.gradient.primary,
                fontSize: 16,
                fontWeight: 700,
              }}
            />
          ) : (
            <Avatar
              sx={{
                width: 36,
                height: 36,
                background: (theme) => theme.palette.gradient.primary,
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              {authorName.charAt(0)}
            </Avatar>

          )}
          <Typography variant="body2" fontWeight={600} sx={{ overflowWrap: 'break-word' }}>
            {authorName}
          </Typography>

        </Box>


        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <AccessTime sx={{ fontSize: 18 }} />
          <Typography variant="body2">
            发布于 {dayjs(post.createdAt).format('YYYY-MM-DD')}
          </Typography>

        </Box>


        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <AccessTime sx={{ fontSize: 18 }} />
          <Typography variant="body2">
            {post.readingTime} 分钟阅读
          </Typography>

        </Box>


        {post.views !== undefined && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Visibility sx={{ fontSize: 18 }} />
            <Typography variant="body2">{post.views}</Typography>

          </Box>

        )}
      </Box>

    </Box>

    </Fade>

  );
}
