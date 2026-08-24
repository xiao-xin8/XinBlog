import { Box, useMediaQuery, useTheme } from '@mui/material';
import { PostCard } from '@/components/Common/PostCard';
import { useSiteStore } from '@/stores/siteStore';
import { resolveSpacingConfig } from '@/utils/spacingConfig';
import type { Post } from '@/types';

interface PostListHorizontalProps {
  posts: Post[];
  theme?: import('@/types').PostCardThemeConfig;
}

export function PostListHorizontal({ posts, theme }: PostListHorizontalProps) {
  const themeMui = useTheme();
  const isDesktop = useMediaQuery(themeMui.breakpoints.up('md'));
  const { config } = useSiteStore();
  const spacing = resolveSpacingConfig(config.spacing);
  const gap = isDesktop ? spacing.postListGap.desktop : spacing.postListGap.mobile;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: gap / 8 }}>
      {posts.map((post, i) => (
        <PostCard
          key={post.id}
          post={post}
          theme={theme}
          forcedLayout="horizontal"
          index={i}
          height={{ xs: 280, sm: 320, md: 360 }}
        />
      ))}
    </Box>

  );
}
