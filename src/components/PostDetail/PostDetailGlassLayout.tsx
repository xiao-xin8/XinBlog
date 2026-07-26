import { Box, alpha } from '@mui/material';
import type { Post, PostDetailThemeConfig } from '@/types';
import type { HeadingItem } from '@/components/Post/TableOfContents';
import { PostDetailHeader } from './PostDetailHeader';
import { PostDetailContent } from './PostDetailContent';
import { PostDetailFooter } from './PostDetailFooter';
import { PostDetailAuthorCard } from './PostDetailAuthorCard';
import { PostDetailRecentPosts } from './PostDetailRecentPosts';
import { PostDetailTOC } from './PostDetailTOC';

import CommentSection from '@/components/Comment/CommentSection';

interface PostDetailGlassLayoutProps {
  post: Post;
  siblings: Post[];
  theme: PostDetailThemeConfig;
  headings: HeadingItem[];
  onHeadingsExtracted?: (headings: HeadingItem[]) => void;
}

export function PostDetailGlassLayout({
  post,
  siblings,
  theme,
  headings,
  onHeadingsExtracted,
}: PostDetailGlassLayoutProps) {
  const params = theme.params || {};
  const glassOpacity = Number(params.glassOpacity ?? theme.glassOpacity ?? 0.6);
  const contentMaxWidth = Number(params.contentMaxWidth ?? theme.contentMaxWidth ?? 900);
  const showSidebar = params.showSidebar ?? theme.showSidebar ?? true;
  const showAuthorCard = params.showAuthorCard ?? theme.showAuthorCard ?? true;
  const showRecentPosts = params.showRecentPosts ?? theme.showRecentPosts ?? true;
  const showTOC = params.showTOC ?? theme.showTOC ?? true;

  return (
    <Box
      sx={{
        width: { xs: '100%', sm: '95%' },
        maxWidth: contentMaxWidth + 320 + 64,
        mx: 'auto',
        mt: { xs: 4, md: 6 },
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: { xs: 3, md: 4 },
        position: 'relative',
        zIndex: 1,
        pb: 8,
      }}
    >
      <Box
        component="article"
        sx={{
          flex: 1,
          minWidth: 0,
          borderRadius: 1,
          bgcolor: (t) =>
            t.palette.mode === 'light'
              ? `rgba(255,255,255,${glassOpacity})`
              : `rgba(30,41,59,${Math.max(0.3, glassOpacity - 0.2)})`,
          backdropFilter: 'blur(20px)',
          border: (t) => `1px solid ${alpha(t.palette.divider, 0.4)}`,
          boxShadow: (t) =>
            t.palette.mode === 'light'
              ? '0 20px 60px rgba(0,0,0,0.08)'
              : '0 20px 60px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          transition: 'all 0.5s ease',
        }}
      >
        <Box sx={{ p: { xs: 2, sm: 3, md: 6 } }}>
          <PostDetailHeader post={post} />
          <PostDetailContent content={post.content} onHeadingsExtracted={onHeadingsExtracted} />
          <PostDetailFooter post={post} siblings={siblings} />
          <CommentSection slug={post.slug} />
        </Box>
      </Box>

      {showSidebar && (
        <Box
          component="aside"
          sx={{
            width: { xs: '100%', md: 260, lg: 320 },
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          {showAuthorCard && <PostDetailAuthorCard />}
          {showRecentPosts && <PostDetailRecentPosts posts={siblings} currentSlug={post.slug} />}
          {showTOC && <PostDetailTOC headings={headings} />}
        </Box>
      )}
    </Box>
  );
}
