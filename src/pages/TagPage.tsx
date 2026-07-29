import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { Container, Box, Typography, Fade, Chip, alpha, CircularProgress, Button } from '@mui/material';
import { LocalOffer, ExpandMore, ChevronLeft, ChevronRight } from '@mui/icons-material';
import { fetchTags, fetchPostsPage } from '@/api/posts';
import { useSiteStore } from '@/stores/siteStore';
import { PostList } from '@/components/Post/PostList';
import type { Tag, Post, PaginationMode } from '@/types';
export function TagPage() {
  const { slug } = useParams<{ slug: string }>();
  const { config } = useSiteStore();
  const paginationMode: PaginationMode = config.paginationMode || 'load-more';
  const pageSize = Math.max(1, config.pageSize ?? 9);
  const [tags, setTags] = useState<Tag[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestKeyRef = useRef(0);
  const activeSlug = slug === 'all' ? undefined : slug;
  const loadPosts = useCallback(async (targetPage: number, append: boolean) => {
    const key = ++requestKeyRef.current;
    const isInitial = targetPage === 1 && !append;
    if (isInitial) setLoading(true);
    else setLoadingMore(true);
    const [tagsData, postsData] = await Promise.all([
      fetchTags(),
      fetchPostsPage({ page: targetPage, limit: pageSize, tag: activeSlug }),
    ]);
    if (key !== requestKeyRef.current) return;
    setTags(tagsData);
    setPosts((prev) => (append ? [...prev, ...postsData.list] : postsData.list));
    setTotal(postsData.total);
    setPage(targetPage);
    if (isInitial) setLoading(false);
    setLoadingMore(false);
  }, [activeSlug, pageSize]);
  useEffect(() => {
    requestKeyRef.current += 1;
    loadPosts(1, false);
  }, [activeSlug, loadPosts]);
  const hasMore = posts.length < total;
  const hasPrev = page > 1;
  const hasNext = posts.length < total;
  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadPosts(page + 1, true);
    }
  };
  const handlePrevPage = () => {
    if (hasPrev) {
      loadPosts(page - 1, false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  const handleNextPage = () => {
    if (hasNext) {
      loadPosts(page + 1, false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  if (slug === 'all') {
    return (
      <Fade in timeout={500}>
        <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 }, pb: 8 }}>
          <Typography variant="h3" component="h1" sx={{ fontWeight: 800, mb: 1, fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' } }}>
            标签
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
            探索所有话题
          </Typography>
          <Box
            sx={{
              display: 'flex',
              gap: { xs: 1, sm: 1.5 },
              flexWrap: 'wrap',
              mb: { xs: 4, md: 6 },
              maxHeight: { xs: 220, sm: 'none' },
              overflowY: { xs: 'auto', sm: 'visible' },
            }}
          >
            {tags.map((tag) => (
              <Chip
                key={tag.id}
                component={Link}
                to={`/tag/${tag.slug}`}
                clickable
                icon={<LocalOffer sx={{ fontSize: { xs: 18, sm: 20 } }} />}
                label={`${tag.name} (${tag.count || 0})`}
                sx={{
                  borderRadius: 1,
                  px: { xs: 0.75, sm: 1 },
                  py: { xs: 1.5, sm: 2.5 },
                  minHeight: { xs: 44, sm: 'auto' },
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                  fontWeight: 600,
                  backgroundColor: (theme) =>
                    tag.color
                      ? alpha(tag.color, theme.palette.mode === 'light' ? 0.12 : 0.2)
                      : alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.1 : 0.2),
                  color: tag.color || 'primary.main',
                  '&:hover': {
                    backgroundColor: (theme) =>
                      tag.color
                        ? alpha(tag.color, theme.palette.mode === 'light' ? 0.22 : 0.3)
                        : alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.2 : 0.3),
                  },
                }}
              />
            ))}
          </Box>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 3, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
            全部文章
          </Typography>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Fade in timeout={400}>
              <Box>
                <PostList posts={posts} />
                <Box sx={{ mt: 5, display: 'flex', justifyContent: 'center' }}>
                  {paginationMode === 'load-more' ? (
                    <Button
                      variant="outlined"
                      size="large"
                      onClick={handleLoadMore}
                      disabled={!hasMore || loadingMore}
                      startIcon={loadingMore ? <CircularProgress size={16} color="inherit" /> : <ExpandMore />}
                      sx={{
                        px: 4,
                        py: 1.2,
                        borderRadius: (theme) => Math.max(8, theme.shape.borderRadius - 4),
                        fontWeight: 700,
                        minWidth: 160,
                      }}
                    >
                      {loadingMore ? '加载中...' : hasMore ? '加载更多' : '没有更多了'}
                    </Button>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Button
                        variant="outlined"
                        onClick={handlePrevPage}
                        disabled={!hasPrev}
                        startIcon={<ChevronLeft />}
                        sx={{
                          borderRadius: (theme) => Math.max(8, theme.shape.borderRadius - 4),
                          fontWeight: 700,
                        }}
                      >
                        上一页
                      </Button>
                      <Box
                        sx={{
                          px: 2,
                          py: 0.75,
                          minWidth: 40,
                          textAlign: 'center',
                          borderRadius: (theme) => Math.max(8, theme.shape.borderRadius - 4),
                          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                          color: 'primary.main',
                          fontWeight: 700,
                        }}
                      >
                        {page}
                      </Box>
                      <Button
                        variant="outlined"
                        onClick={handleNextPage}
                        disabled={!hasNext}
                        endIcon={<ChevronRight />}
                        sx={{
                          borderRadius: (theme) => Math.max(8, theme.shape.borderRadius - 4),
                          fontWeight: 700,
                        }}
                      >
                        下一页
                      </Button>
                    </Box>
                  )}
                </Box>
              </Box>
            </Fade>
          )}
        </Container>
      </Fade>
    );
  }
  const tag = tags.find((t) => t.slug === slug);
  if (!loading && !tag) {
    return <Navigate to="/404" replace />;
  }
  return (
    <Fade in timeout={500}>
        <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 }, pb: 8 }}>
          {loading || !tag ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Fade in timeout={400}>
              <Box sx={{ textAlign: 'center', mb: { xs: 3, md: 6 } }}>
                <Chip
                  icon={<LocalOffer sx={{ fontSize: { xs: 18, sm: 22 } }} />}
                  label={tag.name}
                  sx={{
                    mb: { xs: 1.5, sm: 2 },
                    fontSize: { xs: '0.95rem', sm: '1.2rem' },
                    py: { xs: 1.25, sm: 2.5 },
                    px: { xs: 1.25, sm: 2 },
                    minHeight: { xs: 44, sm: 'auto' },
                    height: 'auto',
                    borderRadius: 1,
                    backgroundColor: (theme) =>
                      alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.12 : 0.2),
                    color: 'primary.main',
                    fontWeight: 700,
                    '& .MuiChip-label': {
                      whiteSpace: 'normal',
                      overflowWrap: 'break-word',
                      maxWidth: '100%',
                    },
                  }}
                />
                <Typography variant="h3" component="h1" sx={{ fontWeight: 800, mb: 1, fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' }, overflowWrap: 'break-word' }}>
                  标签：{tag.name}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                  共 {total} 篇文章
                </Typography>
                <Box sx={{ mt: { xs: 3, md: 6 }, textAlign: 'left' }}>
                  <PostList posts={posts} />
                </Box>
                <Box sx={{ mt: 5, display: 'flex', justifyContent: 'center' }}>
                  {paginationMode === 'load-more' ? (
                    <Button
                      variant="outlined"
                      size="large"
                      onClick={handleLoadMore}
                      disabled={!hasMore || loadingMore}
                      startIcon={loadingMore ? <CircularProgress size={16} color="inherit" /> : <ExpandMore />}
                      sx={{
                        px: 4,
                        py: 1.2,
                        borderRadius: (theme) => Math.max(8, theme.shape.borderRadius - 4),
                        fontWeight: 700,
                        minWidth: 160,
                      }}
                    >
                      {loadingMore ? '加载中...' : hasMore ? '加载更多' : '没有更多了'}
                    </Button>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Button
                        variant="outlined"
                        onClick={handlePrevPage}
                        disabled={!hasPrev}
                        startIcon={<ChevronLeft />}
                        sx={{
                          borderRadius: (theme) => Math.max(8, theme.shape.borderRadius - 4),
                          fontWeight: 700,
                        }}
                      >
                        上一页
                      </Button>
                      <Box
                        sx={{
                          px: 2,
                          py: 0.75,
                          minWidth: 40,
                          textAlign: 'center',
                          borderRadius: (theme) => Math.max(8, theme.shape.borderRadius - 4),
                          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                          color: 'primary.main',
                          fontWeight: 700,
                        }}
                      >
                        {page}
                      </Box>
                      <Button
                        variant="outlined"
                        onClick={handleNextPage}
                        disabled={!hasNext}
                        endIcon={<ChevronRight />}
                        sx={{
                          borderRadius: (theme) => Math.max(8, theme.shape.borderRadius - 4),
                          fontWeight: 700,
                        }}
                      >
                        下一页
                      </Button>
                    </Box>
                  )}
                </Box>
              </Box>
            </Fade>
          )}
        </Container>
      </Fade>
  );
}