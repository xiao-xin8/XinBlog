import { useState, useEffect, Suspense } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import {
  Container,
  Box,
  Button,
  Divider,
  Fade,
  Typography,
  alpha,
  CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ArrowBack, ArrowForward, KeyboardArrowUp } from '@mui/icons-material';
import { fetchPostBySlug, fetchPosts, transformPost, type PostsResponse } from '@/api/posts';
import { peekCache } from '@/api/client';
import { PostHeader } from '@/components/Post/PostHeader';
import { PostContent } from '@/components/Post/PostContent';
import LikeButton from '@/components/Post/LikeButton';
import ShareButtons from '@/components/Post/ShareButtons';
import CommentSection from '@/components/Comment/CommentSection';
import { Loading } from '@/components/Common/Loading';
import { TableOfContents, type HeadingItem } from '@/components/Post/TableOfContents';
import type { Post } from '@/types';

interface PostContentSectionProps {
  post: Post;
  siblings: Post[];
  onHeadingsExtracted?: (headings: HeadingItem[]) => void;
}

function PostContentSection({ post, siblings, onHeadingsExtracted }: PostContentSectionProps) {
  const currentIndex = siblings.findIndex((p) => p.id === post.id);
  const prevPost = currentIndex > 0 ? siblings[currentIndex - 1] : undefined;
  const nextPost = currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : undefined;

  return (
    <>
      <PostHeader post={post} />
      <PostContent content={post.content} onHeadingsExtracted={onHeadingsExtracted} />

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          my: 3,
        }}
      >
        <LikeButton slug={post.slug} />
        <ShareButtons title={post.title} />
      </Box>

      <Divider sx={{ my: 6 }} />

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 2,
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        {prevPost ? (
          <Button
            component={Link}
            to={`/post/${prevPost.slug}`}
            startIcon={<ArrowBack />}
            sx={{
              justifyContent: { xs: 'flex-start', sm: 'flex-start' },
              textAlign: 'left',
              flex: 1,
              py: 1.5,
              px: 2,
              borderRadius: 1,
              minHeight: { xs: 64, sm: 'auto' },
              backgroundColor: (theme) =>
                alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.06 : 0.08),
              '&:hover': {
                backgroundColor: (theme) =>
                  alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.12 : 0.15),
              },
            }}
          >
            <Box sx={{ width: '100%' }}>
              <Typography variant="caption" color="text.secondary" display="block">
                上一篇
              </Typography>
              <Typography
                variant="body2"
                fontWeight={600}
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: { xs: 2, sm: 1 },
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {prevPost.title}
              </Typography>
            </Box>
          </Button>
        ) : (
          <Box flex={1} />
        )}

        {nextPost ? (
          <Button
            component={Link}
            to={`/post/${nextPost.slug}`}
            endIcon={<ArrowForward />}
            sx={{
              justifyContent: { xs: 'flex-start', sm: 'flex-end' },
              textAlign: { xs: 'left', sm: 'right' },
              flex: 1,
              py: 1.5,
              px: 2,
              borderRadius: 1,
              minHeight: { xs: 64, sm: 'auto' },
              backgroundColor: (theme) =>
                alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.06 : 0.08),
              '&:hover': {
                backgroundColor: (theme) =>
                  alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.12 : 0.15),
              },
            }}
          >
            <Box sx={{ width: '100%' }}>
              <Typography variant="caption" color="text.secondary" display="block">
                下一篇
              </Typography>
              <Typography
                variant="body2"
                fontWeight={600}
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: { xs: 2, sm: 1 },
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {nextPost.title}
              </Typography>
            </Box>
          </Button>
        ) : (
          <Box flex={1} />
        )}
      </Box>

      <CommentSection slug={post.slug} />
    </>
  );
}

function getScrollContainer(): HTMLElement | null {
  return document.querySelector('main') as HTMLElement | null;
}

export function PostDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [siblings, setSiblings] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [headings, setHeadings] = useState<HeadingItem[]>([]);

  useEffect(() => {
    if (!slug) return;
    let mounted = true;
    setLoading(true);

    
    const cachedPosts = peekCache<PostsResponse>('/api/v1/posts');
    const cachedPost = cachedPosts.data?.list.find((p) => p.slug === slug);
    const initialPost = cachedPost ? transformPost(cachedPost) : null;
    const initialSiblings = cachedPosts.data?.list.map((p) => transformPost(p)) || [];

    if (initialPost) {
      if (!mounted) return;
      setPost(initialPost);
      setSiblings(initialSiblings);
      setLoading(false);
      
      fetchPostBySlug(slug).then((fresh) => {
        if (mounted && fresh) {
          setPost(fresh);
        }
      });
      return () => { mounted = false; };
    }

    Promise.all([fetchPostBySlug(slug), fetchPosts()]).then(([postData, postsData]) => {
      if (!mounted) return;
      setPost(postData);
      setSiblings(postsData);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [slug]);

  if (!loading && !post) {
    return <Navigate to="/404" replace />;
  }

  return (
    <Fade in timeout={500}>
      <Box>
        <Container maxWidth="lg" sx={{ py: 4, pb: 8 }}>
          {loading || !post ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Suspense fallback={<Loading />}>
              <PostContentSection post={post} siblings={siblings} onHeadingsExtracted={setHeadings} />
            </Suspense>
          )}
        </Container>

        <TableOfContents headings={headings} />
        <ReadingProgressButton />
      </Box>
    </Fade>
  );
}

function ReadingProgressButton() {
  const theme = useTheme();
  const [readingProgress, setReadingProgress] = useState(0);

  useEffect(() => {
    const container = getScrollContainer();
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const docHeight = container.scrollHeight - container.clientHeight;
      const ratio = docHeight > 0 ? scrollTop / docHeight : 0;
      setReadingProgress(Math.min(1, Math.max(0, ratio)));
    };

    handleScroll();
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const progressRadius = 20;
  const progressCircumference = 2 * Math.PI * progressRadius;

  return (
    <Box
      onClick={() => {
        const container = getScrollContainer();
        if (container) {
          container.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }}
      aria-label="回到顶部"
      sx={{
        position: 'fixed',
        right: { xs: 16, sm: 24 },
        bottom: { xs: 16, sm: 24 },
        width: 56,
        height: 56,
        borderRadius: '50%',
        bgcolor: 'background.paper',
        boxShadow: (t) =>
          t.palette.mode === 'light'
            ? `0 4px 20px ${alpha(t.palette.primary.main, 0.2)}`
            : `0 4px 20px ${alpha(t.palette.common.black, 0.4)}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        opacity: 0.2,
        transform: 'scale(1)',
        transition: (t) =>
          t.transitions.create(['opacity', 'transform', 'box-shadow'], {
            duration: t.transitions.duration.short,
          }),
        pointerEvents: 'auto',
        zIndex: 1500,
        '&:hover': {
          opacity: 0.6,
          transform: 'scale(1.08)',
          boxShadow: (t) =>
            t.palette.mode === 'light'
              ? `0 6px 28px ${alpha(t.palette.primary.main, 0.3)}`
              : `0 6px 28px ${alpha(t.palette.common.black, 0.5)}`,
        },
      }}
    >
      <svg
        width={48}
        height={48}
        viewBox="0 0 48 48"
        style={{ position: 'absolute', transform: 'rotate(-90deg)' }}
        aria-hidden
      >
        <circle
          cx={24}
          cy={24}
          r={progressRadius}
          fill="none"
          stroke={alpha(theme.palette.primary.main, 0.12)}
          strokeWidth={3}
        />
        <circle
          cx={24}
          cy={24}
          r={progressRadius}
          fill="none"
          stroke={theme.palette.primary.main}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={progressCircumference}
          strokeDashoffset={progressCircumference * (1 - readingProgress)}
        />
      </svg>
      <KeyboardArrowUp sx={{ color: 'primary.main', position: 'relative', zIndex: 1 }} />
    </Box>
  );
}
