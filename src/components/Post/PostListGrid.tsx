import { Grid, useMediaQuery, useTheme } from '@mui/material';
import { PostCard } from '@/components/Common/PostCard';
import { useSiteStore } from '@/stores/siteStore';
import { resolveSpacingConfig } from '@/utils/spacingConfig';
import type { Post } from '@/types';

interface PostListGridProps {
  posts: Post[];
  theme?: import('@/types').PostCardThemeConfig;
}

export function PostListGrid({ posts, theme }: PostListGridProps) {
  const themeMui = useTheme();
  const isDesktop = useMediaQuery(themeMui.breakpoints.up('md'));
  const { config } = useSiteStore();
  const spacing = resolveSpacingConfig(config.spacing);
  const gap = isDesktop ? spacing.postListGap.desktop : spacing.postListGap.mobile;
  return (
    <Grid container spacing={gap / 8}>
      {posts.map((post) => (
        <Grid item xs={12} md={6} lg={4} key={post.id} sx={{ display: 'flex', flexDirection: 'column' }}>
          <PostCard post={post} theme={theme} />
        </Grid>
      ))}
    </Grid>
  );
}
