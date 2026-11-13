import { Box, Grid, useMediaQuery, useTheme } from '@mui/material';
import { PostCard } from '@/components/Common/PostCard';
import { useSiteStore } from '@/stores/siteStore';
import { resolveSpacingConfig } from '@/utils/spacingConfig';
import type { Post, PostCardThemeConfig } from '@/types';

interface PostListMagazineProps {
  posts: Post[];
  theme?: PostCardThemeConfig;
}

export function PostListMagazine({ posts, theme }: PostListMagazineProps) {
  const themeMui = useTheme();
  const isDesktop = useMediaQuery(themeMui.breakpoints.up('md'));
  const { config } = useSiteStore();
  const spacing = resolveSpacingConfig(config.spacing);
  const gap = isDesktop ? spacing.postListGap.desktop : spacing.postListGap.mobile;

  if (posts.length === 0) return null;

  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: gap / 8 }}>
      <PostCard post={featured} theme={theme} forcedLayout="overlay" height={{ xs: 320, sm: 400, md: 480 }} />
      {rest.length > 0 && (
        <Grid container spacing={gap / 8}>
          {rest.map((post) => (
            <Grid item xs={12} md={6} key={post.id} sx={{ display: 'flex', flexDirection: 'column' }}>
              <PostCard post={post} theme={theme} forcedLayout="overlay" height={{ xs: 260, sm: 300, md: 340 }} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
