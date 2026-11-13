import { Container, Fade } from '@mui/material';
import type { Post, PostDetailThemeConfig } from '@/types';
import type { HeadingItem } from '@/components/Post/TableOfContents';
import { PostDetailHeader } from './PostDetailHeader';
import { PostDetailContent } from './PostDetailContent';
import { PostDetailFooter } from './PostDetailFooter';
import CommentSection from '@/components/Comment/CommentSection';

interface PostDetailDefaultLayoutProps {
  post: Post;
  siblings: Post[];
  theme: PostDetailThemeConfig;
  onHeadingsExtracted?: (headings: HeadingItem[]) => void;
}

export function PostDetailDefaultLayout({
  post,
  siblings,
  onHeadingsExtracted,
}: PostDetailDefaultLayoutProps) {
  return (
    <Fade in timeout={400}>
      <Container maxWidth="lg" sx={{ py: 4, pb: 8, px: { xs: 1, sm: 2, md: 3 } }}>
        <PostDetailHeader post={post} showBackButton={false} />
        <PostDetailContent content={post.content} onHeadingsExtracted={onHeadingsExtracted} />
        <PostDetailFooter post={post} siblings={siblings} />
        <CommentSection slug={post.slug} />
      </Container>
    </Fade>
  );
}
