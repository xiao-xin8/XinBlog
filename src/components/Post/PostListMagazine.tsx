import { Box, Grid } from '@mui/material';
import { PostCard } from '@/components/Common/PostCard';
import type { Post, PostCardThemeConfig } from '@/types';
interface PostListMagazineProps {
  posts: Post[];
  theme?: PostCardThemeConfig;
}
export function PostListMagazine({ posts, theme }: PostListMagazineProps) {
  if (posts.length === 0) return null;
  const featured = posts[0];
  const rest = posts.slice(1);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PostCard post={featured} theme={theme} forcedLayout="overlay" height={{ xs: 320, sm: 400, md: 480 }} />
      {rest.length > 0 && (
        <Grid container spacing={3}>
          {rest.map((post) => (
            <Grid item xs={12} md={6} key={post.id} sx={{ display: 'flex' }}>
              <PostCard post={post} theme={theme} forcedLayout="overlay" height={{ xs: 260, sm: 300, md: 340 }} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}