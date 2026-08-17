import { useState, useEffect, Suspense } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Box, Fade, alpha, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { KeyboardArrowUp } from '@mui/icons-material';
import { fetchPostBySlug, fetchPosts, transformPost, type PostsResponse } from '@/api/posts';
import { peekCache } from '@/api/client';
import { Loading } from '@/components/Common/Loading';
import { TableOfContents, type HeadingItem } from '@/components/Post/TableOfContents';
import {
  PostDetailDefaultLayout,
  PostDetailGlassLayout,
} from '@/components/PostDetail';
import { useSiteStore } from '@/stores/siteStore';
import type { Post } from '@/types';

function getScrollContainer(): HTMLElement | null {
  return document.querySelector('main') as HTMLElement | null;
}

export function PostDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { config } = useSiteStore();
  const postDetailTheme = config.postDetailTheme || { variant: 'default' };
  const isGlassTheme = postDetailTheme.variant === 'glass';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
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
    <Fade in timeout={400}>
      <Box>
        {loading || !post ? (
          <Loading />
        ) : (
          <Suspense fallback={<Loading />}>
            {isGlassTheme ? (
              <PostDetailGlassLayout
                post={post}
                siblings={siblings}
                theme={postDetailTheme}
                headings={headings}
                onHeadingsExtracted={setHeadings}
              />
            ) : (
              <PostDetailDefaultLayout
                post={post}
                siblings={siblings}
                theme={postDetailTheme}
                onHeadingsExtracted={setHeadings}
              />
            )}
          </Suspense>
        )}

        {(!isGlassTheme || isMobile) && <TableOfContents headings={headings} />}
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
