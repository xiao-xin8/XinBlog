import { useEffect, useState } from 'react';
import { Box, Chip, Typography, alpha } from '@mui/material';
import { Article } from '@mui/icons-material';
import { fetchPostsPage } from '@/api/posts';
import { useHeroEditContext } from '@/components/Hero/HeroEditContext';
import type { HeroWidgetConfig, Post } from '@/types';

interface PostsWidgetPropsFromConfig {
  limit?: number;
  showCover?: boolean;
  showExcerpt?: boolean;
  showTags?: boolean;
}

export function PostsWidget({ config }: { config: HeroWidgetConfig }) {
  const props = (config.props || {}) as PostsWidgetPropsFromConfig;
  const { editable } = useHeroEditContext();
  const limit = props.limit || 5;
  const showCover = props.showCover !== false;
  const showExcerpt = props.showExcerpt !== false;
  const showTags = props.showTags !== false;
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  
  const { w, h } = config;
  const isTiny = w === 1 && h === 1;
  const isTall = w === 1 && h >= 2;
  const isWide = h === 1 && w >= 2;
  const isCompact = (w === 2 && h === 2) || isWide;
  const isLarge = w >= 3 && h >= 2;
  const displayLimit = isTiny ? 1 : isWide ? 1 : isTall ? h + 1 : isCompact ? 2 : limit;
  const displayExcerpt = showExcerpt && (isLarge || (isTall && h >= 3)) && !isWide;
  const displayTags = showTags && (isLarge || (isTall && h >= 3)) && !isWide;
  const displayCover = showCover && !isTiny && !isTall && !isWide;

  useEffect(() => {
    let cancelled = false;
    fetchPostsPage({ page: 1, limit: displayLimit })
      .then((res) => {
        if (!cancelled) setPosts(res.list);
      })
      .catch(() => {
        if (!cancelled) setPosts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [displayLimit]);

  const getItemProps = (post: Post) =>
    editable
      ? { component: 'div' as const }
      : { component: 'a' as const, href: `/post/${post.slug}` };

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexShrink: 0 }}>
        <Article fontSize="small" color="primary" />
        <Typography variant="subtitle2" fontWeight={700}>
          最新文章
        </Typography>

      </Box>


      {loading ? (
        <Typography variant="body2" color="text.secondary">
          加载中...
        </Typography>

      ) : posts.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          暂无文章
        </Typography>

      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {posts.slice(0, displayLimit).map((post) => (
            <Box
              key={post.id}
              {...getItemProps(post)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1,
                borderRadius: 1,
                textDecoration: 'none',
                color: 'text.primary',
                bgcolor: (theme) => alpha(theme.palette.background.paper, 0.3),
                '&:hover': { bgcolor: (theme) => alpha(theme.palette.background.paper, 0.5) },
              }}
            >
              {displayCover && post.cover && (
                <Box
                  component="img"
                  src={post.cover}
                  alt={post.title}
                  sx={{ width: 48, height: 48, borderRadius: 1, objectFit: 'cover', flexShrink: 0 }}
                />
              )}
              <Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                <Typography variant="body2" fontWeight={700} noWrap>
                  {post.title}
                </Typography>

                {displayExcerpt && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {post.excerpt}
                  </Typography>

                )}
                {displayTags && post.tags && post.tags.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.25, flexWrap: 'nowrap', overflow: 'hidden' }}>
                    {post.tags.slice(0, 3).map((tag) => (
                      <Chip
                        key={tag.id}
                        label={tag.name}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: 10,
                          borderRadius: 0.75,
                          bgcolor: tag.color ? `${tag.color}20` : (theme) => alpha(theme.palette.primary.main, 0.1),
                          color: tag.color || 'primary.main',
                        }}
                      />
                    ))}
                  </Box>

                )}
              </Box>

            </Box>

          ))}
        </Box>

      )}
    </Box>

  );
}
