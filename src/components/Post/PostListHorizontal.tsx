import { Box } from '@mui/material';
import { PostCard } from '@/components/Common/PostCard';
import type { Post } from '@/types';
interface PostListHorizontalProps {
  posts: Post[];
  theme?: import('@/types').PostCardThemeConfig;
}
export function PostListHorizontal({ posts, theme }: PostListHorizontalProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
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