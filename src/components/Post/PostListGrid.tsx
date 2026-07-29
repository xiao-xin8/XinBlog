import { Grid } from '@mui/material';
import { PostCard } from '@/components/Common/PostCard';
import type { Post } from '@/types';
interface PostListGridProps {
  posts: Post[];
  theme?: import('@/types').PostCardThemeConfig;
}
export function PostListGrid({ posts, theme }: PostListGridProps) {
  return (
    <Grid container spacing={3}>
      {posts.map((post) => (
        <Grid item xs={12} md={6} lg={4} key={post.id} sx={{ display: 'flex' }}>
          <PostCard post={post} theme={theme} />
        </Grid>
      ))}
    </Grid>
  );
}