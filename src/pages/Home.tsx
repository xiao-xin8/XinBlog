import {
  Box,
  Container,
  Typography,
  Chip,
  Fade,
  alpha,
  InputBase,
  IconButton,
  CircularProgress,
  Skeleton,
  Button,
} from '@mui/material';
import {
  Search,
  Clear,
  ExpandMore,
  ChevronLeft,
  ChevronRight,
} from '@mui/icons-material';
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSiteStore } from '@/stores/siteStore';
import { fetchPostsPage, fetchAllPosts, fetchTags } from '@/api/posts';
import { PostList } from '@/components/Post/PostList';
import { TagChip } from '@/components/Common/TagChip';
import { searchPosts } from '@/utils/search';
import type { Post, Tag, PaginationMode } from '@/types';

export function Home() {
  const { config } = useSiteStore();
  const paginationMode: PaginationMode = config.paginationMode || 'load-more';
  const pageSize = Math.max(1, config.pageSize ?? 9);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryFromUrl = searchParams.get('q') || '';
  const [inputValue, setInputValue] = useState(queryFromUrl);
  const [posts, setPosts] = useState<Post[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [heroBgLoaded, setHeroBgLoaded] = useState(false);
  const requestKeyRef = useRef(0);

  useEffect(() => {
    setInputValue(queryFromUrl);
  }, [queryFromUrl]);

  const loadPosts = useCallback(async (targetPage: number, append: boolean) => {
    const key = ++requestKeyRef.current;
    const isInitial = targetPage === 1 && !append;
    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    const [postsData, tagsData] = await Promise.all([
      fetchPostsPage({ page: targetPage, limit: pageSize }),
      fetchTags(),
    ]);

    if (key !== requestKeyRef.current) return;

    setPosts((prev) => (append ? [...prev, ...postsData.list] : postsData.list));
    setTotal(postsData.total);
    setPage(targetPage);
    setTags(tagsData);
    if (isInitial) setLoading(false);
    setLoadingMore(false);
  }, [pageSize]);

  const loadAllForSearch = useCallback(async () => {
    const key = ++requestKeyRef.current;
    setLoading(true);
    const [allPosts, tagsData] = await Promise.all([fetchAllPosts(), fetchTags()]);
    if (key !== requestKeyRef.current) return;
    setPosts(allPosts);
    setTotal(allPosts.length);
    setPage(1);
    setTags(tagsData);
    setLoading(false);
  }, []);

  useEffect(() => {
    requestKeyRef.current += 1;
    if (!queryFromUrl.trim()) {
      loadPosts(1, false);
    } else {
      loadAllForSearch();
    }
  }, [queryFromUrl, loadPosts, loadAllForSearch]);

  const filteredPosts = useMemo(() => {
    if (!queryFromUrl.trim()) return posts;
    return searchPosts(posts, queryFromUrl).map((r) => r.post);
  }, [queryFromUrl, posts]);

  const isSearch = Boolean(queryFromUrl.trim());
  const hasMore = !isSearch && posts.length < total;
  const hasPrev = !isSearch && page > 1;
  const hasNext = !isSearch && posts.length < total;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed) {
      setSearchParams({ q: trimmed });
    } else {
      setSearchParams({});
    }
  };

  const handleClear = () => {
    setInputValue('');
    setSearchParams({});
  };

  const handleTagClick = (tagName: string) => {
    setInputValue(tagName);
    setSearchParams({ q: tagName });
  };

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

  return (
    <Fade in timeout={500}>
      <Box>
        <Box
          sx={{
            background: config.hero?.backgroundColor || ((theme) => theme.palette.gradient.hero),
            py: { xs: 6, md: 10 },
            mb: { xs: 4, md: 6 },
            borderRadius: (theme) => `0 0 ${theme.shape.borderRadius}px ${theme.shape.borderRadius}px`,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {config.hero?.backgroundImage && (
            <>
              {!heroBgLoaded && (
                <Skeleton
                  variant="rectangular"
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 0,
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
                  }}
                />
              )}
              <Box
                component="img"
                src={config.hero.backgroundImage}
                alt=""
                onLoad={() => setHeroBgLoaded(true)}
                sx={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  zIndex: 0,
                  opacity: heroBgLoaded ? 1 : 0,
                  transition: (theme) => theme.transitions.create('opacity', { duration: 600 }),
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 1,
                  backgroundColor: (theme) => alpha(theme.palette.background.default, 0.35),
                  borderRadius: 'inherit',
                }}
              />
            </>
          )}
          <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1 }}>
            <Box sx={{ textAlign: 'center', maxWidth: 720, mx: 'auto' }}>
              {config.hero?.badge && (
                <Chip
                  label={config.hero.badge}
                  sx={{
                    mb: 3,
                    backgroundColor: (theme) =>
                      alpha(theme.palette.background.paper, theme.palette.mode === 'light' ? 0.7 : 0.15),
                    color: 'primary.main',
                    fontWeight: 600,
                    backdropFilter: 'blur(8px)',
                  }}
                />
              )}
              {config.hero?.title && (
                <Typography
                  variant="h2"
                  component="h1"
                  sx={{
                    fontWeight: 800,
                    mb: 2,
                    fontSize: { xs: '2rem', sm: '3rem', md: '3.75rem' },
                    overflowWrap: 'break-word',
                    background: (theme) => theme.palette.gradient.primary,
                    backgroundClip: 'text',
                    textFillColor: 'transparent',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {config.hero.title}
                </Typography>
              )}
              {config.hero?.subtitle && (
                <Typography
                  variant="h5"
                  color="text.secondary"
                  sx={{ fontWeight: 400, lineHeight: 1.6, mb: 4, fontSize: { xs: '1rem', sm: '1.25rem', md: '1.5rem' }, overflowWrap: 'break-word' }}
                >
                  {config.hero.subtitle}
                </Typography>
              )}

              {/* 首页搜索 */}
              <Box
                component="form"
                onSubmit={handleSearchSubmit}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  width: { xs: '100%', sm: 'auto' },
                  maxWidth: { xs: '100%', sm: 560 },
                  mx: 'auto',
                  px: { xs: 1.5, sm: 2 },
                  py: 1,
                  borderRadius: 1,
                  backgroundColor: (theme) =>
                    theme.palette.mode === 'light'
                      ? alpha(theme.palette.background.paper, 0.9)
                      : alpha(theme.palette.common.white, 0.08),
                  backdropFilter: 'blur(8px)',
                  boxShadow: (theme) =>
                    theme.palette.mode === 'light'
                      ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
                      : `0 4px 20px ${alpha(theme.palette.common.black, 0.3)}`,
                  transition: (theme) =>
                    theme.transitions.create(['background-color', 'box-shadow'], {
                      easing: theme.transitions.easing.easeInOut,
                      duration: theme.transitions.duration.short,
                    }),
                  '&:focus-within': {
                    backgroundColor: (theme) =>
                      theme.palette.mode === 'light'
                        ? alpha(theme.palette.background.paper, 1)
                        : alpha(theme.palette.common.white, 0.12),
                    boxShadow: (theme) => `0 0 0 2px ${alpha(theme.palette.primary.main, 0.3)}`,
                  },
                }}
              >
                <Search sx={{ color: 'text.secondary', mr: 1.5, fontSize: 22 }} />
                <InputBase
                  fullWidth
                  placeholder="搜索文章标题、摘要或标签..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  inputProps={{ 'aria-label': '搜索文章' }}
                  sx={{
                    typography: 'body1',
                    '& input::placeholder': {
                      color: 'text.secondary',
                      opacity: 0.7,
                    },
                  }}
                />
                {inputValue && (
                  <IconButton
                    onClick={handleClear}
                    aria-label="清空搜索"
                    sx={{ color: 'text.secondary', ml: 0.5, width: { xs: 36, sm: 32 }, height: { xs: 36, sm: 32 } }}
                  >
                    <Clear fontSize="small" />
                  </IconButton>
                )}
              </Box>

              <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                {tags.slice(0, 5).map((tag) => (
                  <TagChip
                    key={tag.id}
                    tag={tag}
                    size="small"
                    onClick={() => handleTagClick(tag.name)}
                  />
                ))}
              </Box>
            </Box>
          </Container>
        </Box>

        <Container maxWidth="xl" sx={{ pb: 8 }}>
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: { xs: 'flex-start', sm: 'space-between' }, mb: 3, flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="h4" component="h2" sx={{ fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}>
                {queryFromUrl ? '搜索结果' : '最新文章'}
              </Typography>
              {queryFromUrl && (
                <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'break-word', maxWidth: '100%' }}>
                  “{queryFromUrl}” 共 {filteredPosts.length} 篇
                  <Box
                    component="button"
                    onClick={handleClear}
                    sx={{
                      ml: 1,
                      background: 'none',
                      border: 'none',
                      p: 0,
                      color: 'primary.main',
                      cursor: 'pointer',
                      fontSize: 'inherit',
                      fontWeight: 500,
                      '&:hover': { textDecoration: 'underline' },
                    }}
                  >
                    清除
                  </Box>
                </Typography>
              )}
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Fade in timeout={400}>
                <Box>
                  {filteredPosts.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 6 }}>
                      <Typography variant="h6" color="text.secondary" gutterBottom>
                        没有找到相关文章
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        换个关键词试试，或上传一篇把
                      </Typography>
                    </Box>
                  ) : (
                    <PostList posts={filteredPosts} />
                  )}

                  {!isSearch && (
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
                  )}
                </Box>
              </Fade>
            )}
          </Box>

          {!queryFromUrl && !loading && (
            <Box sx={{ mt: 6 }}>
              <Typography variant="h5" component="h3" sx={{ fontWeight: 700, mb: 2, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                标签
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  gap: 1.5,
                  flexWrap: 'wrap',
                  maxHeight: { xs: 180, sm: 'none' },
                  overflowY: { xs: 'auto', sm: 'visible' },
                }}
              >
                {tags.map((tag) => (
                  <TagChip key={tag.id} tag={tag} size="medium" onClick={() => handleTagClick(tag.name)} />
                ))}
              </Box>
            </Box>
          )}
        </Container>
      </Box>
    </Fade>
  );
}
