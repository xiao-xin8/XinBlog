import { PostListGrid } from './PostListGrid';
import { PostListHorizontal } from './PostListHorizontal';
import { PostListMagazine } from './PostListMagazine';
import { useUIStore } from '@/stores/uiStore';
import type { Post } from '@/types';
interface PostListProps {
  posts: Post[];
}
export function PostList({ posts }: PostListProps) {
  const { postLayout } = useUIStore();
  switch (postLayout) {
    case 'list':
      return <PostListHorizontal posts={posts} />;
    case 'magazine':
      return <PostListMagazine posts={posts} />;
    case 'grid':
    default:
      return <PostListGrid posts={posts} />;
  }
}