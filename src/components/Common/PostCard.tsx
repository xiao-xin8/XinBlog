import {
  Paper,
  CardContent,
  Typography,
  Box,
  Chip,
  Skeleton,
  ButtonBase,
  alpha,
  Fade,
} from '@mui/material';
import { AccessTime, Visibility } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { LazyImage } from '@/components/Common/LazyImage';
import { useSiteStore } from '@/stores/siteStore';
import { resolveSpacingConfig } from '@/utils/spacingConfig';
import type { Post, PostCardThemeConfig } from '@/types';
import type { SxProps, Theme } from '@mui/material/styles';
import dayjs from 'dayjs';
import { buildPostCardOutput } from '@/utils/themeRenderers';
import { mergeCardTheme } from '@/utils/postCardTheme';
import { useThemeConfigStore, getActiveColors } from '@/stores/themeConfigStore';

interface PostCardProps {
  post: Post;
  theme?: PostCardThemeConfig;
  forcedLayout?: 'overlay' | 'clean' | 'horizontal';
  height?: { xs?: number; sm?: number; md?: number };
  index?: number;
}

function CardTags({
  post,
  visible,
  justifyContent,
  chipSx,
}: {
  post: Post;
  visible?: boolean;
  justifyContent?: string;
  chipSx?: SxProps<Theme>;
}) {
  if (!visible || post.tags.length === 0) return null;
  return (
    <Box sx={{ mb: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent }}>
      {post.tags.map((tag) => (
        <Chip
          key={tag.id}
          label={tag.name}
          size="small"
          sx={{
            backgroundColor: (theme) =>
              tag.color
                ? alpha(tag.color, theme.palette.mode === 'light' ? 0.12 : 0.2)
                : alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.1 : 0.2),
            color: tag.color || 'primary.main',
            fontWeight: 500,
            ...chipSx,
          }}
        />
      ))}
    </Box>
  );
}

function CardMeta({ post, sx }: { post: Post; sx?: SxProps<Theme> }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', typography: 'caption', ...sx }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <AccessTime sx={{ fontSize: 16 }} />
        {dayjs(post.createdAt).format('YYYY-MM-DD')}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <AccessTime sx={{ fontSize: 16 }} />
        {post.readingTime} 分钟阅读
      </Box>
      {post.views !== undefined && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Visibility sx={{ fontSize: 16 }} />
          {post.views}
        </Box>
      )}
    </Box>
  );
}

function adaptThemeForLayout(theme: PostCardThemeConfig, forcedLayout?: 'overlay' | 'clean' | 'horizontal'): PostCardThemeConfig {
  if (!forcedLayout) return theme;
  const next: PostCardThemeConfig = { ...theme, layout: forcedLayout };
  if (forcedLayout === 'overlay') {
    if (next.variant === 'clean-card') {
      next.variant = 'overlay-card';
    }
  } else if (forcedLayout === 'clean') {
    if (next.variant === 'overlay-card') {
      next.variant = 'clean-card';
    }
  }
  return next;
}

export function PostCard({ post, theme, forcedLayout, height, index }: PostCardProps) {
  const { config } = useSiteStore();
  const themeConfig = useThemeConfigStore();
  const activeColors = getActiveColors(themeConfig);
  const baseTheme = mergeCardTheme(theme || config.cardTheme);
  const cardTheme = adaptThemeForLayout(baseTheme, forcedLayout);
  const cardPadding = resolveSpacingConfig(config.spacing).cardPaddingY;
  const cardPaddingSx = { xs: cardPadding.mobile, sm: cardPadding.desktop };
  const output = buildPostCardOutput(cardTheme, {
    post,
    config,
    themeColor: activeColors.primary,
    borderRadius: config.theme?.borderRadius ?? 16,
  });

  // 横排（图片在左/右、文字在另一侧）由下方横向分支渲染，不走 output 的竖排逻辑
  if (output && cardTheme.layout !== 'horizontal') {
    const mediaAsBackground = output.mediaAsBackground ?? output.layout === 'overlay';
    const rootSx = height ? { ...output.root, height } : output.root;

    // 3D翻书主题：文字介绍在前页，悬停翻开露出垫底图片
    if (output.book) {
      return (
        <Fade in timeout={300} style={{ width: '100%', height: '100%' }}>
          <ButtonBase component={Link} to={`/post/${post.slug}`} sx={{ width: '100%', height: '100%', display: 'block', textAlign: 'left', borderRadius: 1 }}>
            <Paper elevation={0} sx={rootSx}>
              <Box sx={output.book.root}>
                {/* 垫底图片层 */}
                <Box className="bc-base" sx={output.book.base}>
                  <Typography sx={{ fontWeight: 700, px: 1, textAlign: 'center', textShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
                    {post.title}
                  </Typography>
                </Box>
                {/* 文字介绍前页，悬停沿左缘翻开放出图片 */}
                <Box className="bc-cover" sx={output.book.cover}>
                  <CardContent sx={{ ...output.content, overflow: 'auto' }}>
                    <CardTags post={post} visible={cardTheme.showTags} chipSx={output.tag} />
                    <Typography variant="h5" component="h2" sx={output.title}>
                      {post.title}
                    </Typography>
                    {cardTheme.showExcerpt && (
                      <Typography variant="body2" sx={output.excerpt}>
                        {post.excerpt}
                      </Typography>
                    )}
                    {cardTheme.showMeta && <CardMeta post={post} sx={output.meta} />}
                    <Typography sx={{ opacity: 0.6, fontSize: '0.7rem', textAlign: 'center', mt: 1.5 }}>
                      悬停翻阅
                    </Typography>
                  </CardContent>
                </Box>
              </Box>
            </Paper>
          </ButtonBase>
        </Fade>
      );
    }

    return (
      <Fade in timeout={300} style={{ width: '100%', height: '100%' }}>
        <ButtonBase
          component={Link}
          to={`/post/${post.slug}`}
          sx={{
            width: '100%',
            height: '100%',
            display: 'block',
            textAlign: 'left',
            borderRadius: 1,
          }}
        >
          <Paper elevation={0} sx={rootSx}>
            {mediaAsBackground ? (
              <>
                <Box sx={output.media} />
                {output.overlay && <Box sx={output.overlay} />}
                <CardContent sx={output.content}>
                  <CardTags
                    post={post}
                    visible={cardTheme.showTags}
                    justifyContent={((output.content as { alignItems?: string } | undefined)?.alignItems) as string}
                    chipSx={output.tag}
                  />
                  <Typography variant="h5" component="h2" sx={output.title}>
                    {post.title}
                  </Typography>
                  {cardTheme.showExcerpt && (
                    <Typography variant="body2" sx={output.excerpt}>
                      {post.excerpt}
                    </Typography>
                  )}
                  {cardTheme.showMeta && <CardMeta post={post} sx={output.meta} />}
                </CardContent>
              </>
            ) : (
              <>
                {post.cover && (
                  <Box sx={output.media}>
                    <LazyImage src={post.cover} alt={post.title} objectFit="cover" placeholder="skeleton" />
                  </Box>
                )}
                <CardContent sx={output.content}>
                  <CardTags post={post} visible={cardTheme.showTags} chipSx={output.tag} />
                  <Typography className="post-card-title" variant="h5" component="h2" sx={output.title}>
                    {post.title}
                  </Typography>
                  {cardTheme.showExcerpt && (
                    <Typography variant="body1" sx={output.excerpt}>
                      {post.excerpt}
                    </Typography>
                  )}
                  {cardTheme.showMeta && <CardMeta post={post} sx={output.meta} />}
                  {output.action && (
                    <Box component="span" sx={output.action}>
                      阅读更多
                      <span className="card-action-arrow" aria-hidden="true">
                        →
                      </span>
                    </Box>
                  )}
                </CardContent>
              </>
            )}
          </Paper>
        </ButtonBase>
      </Fade>
    );
  }

  const horizontal = forcedLayout === 'horizontal';
  if (horizontal) {
    // 横排下的 3D翻书：文字介绍前页，悬停向上翻开露出垫底图片。此处复用 output 主题样式。
    if (output?.book) {
      return (
        <Fade in timeout={300} style={{ width: '100%', height: '100%' }}>
          <ButtonBase component={Link} to={`/post/${post.slug}`} sx={{ width: '100%', height: '100%', display: 'block', textAlign: 'left', borderRadius: 1 }}>
            <Paper
              elevation={0}
              sx={{ ...(output.root ?? {}), height: height ? '100%' : { xs: 300, sm: 340 }, borderRadius: `${config.theme?.borderRadius ?? 16}px`, overflow: 'visible' }}
            >
              <Box
                className="bc-book"
                sx={{
                  ...(output.book.root ?? {}),
                  height: '100%',
                  '&:hover .bc-cover': {
                    transform: 'rotateX(-84deg)',
                    boxShadow: '0 14px 28px rgba(0,0,0,0.3)',
                  },
                }}
              >
                {/* 垫底图片层 */}
                <Box className="bc-base" sx={output.book.base ?? {}}>
                  <Typography sx={{ fontWeight: 700, px: 1, textAlign: 'center', textShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
                    {post.title}
                  </Typography>
                </Box>
                {/* 文字介绍前页，悬停向上翻开放出图片 */}
                <Box className="bc-cover" sx={{ ...(output.book.cover ?? {}), transformOrigin: '50% 0' }}>
                  <CardContent sx={{ ...(output.content ?? {}), height: '100%', justifyContent: 'center', p: { xs: 1.5, sm: 2 }, overflow: 'auto' }}>
                    <CardTags post={post} visible={cardTheme.showTags} chipSx={output.tag} />
                    <Typography variant="h5" component="h2" sx={output.title}>
                      {post.title}
                    </Typography>
                    {cardTheme.showExcerpt && (
                      <Typography variant="body2" sx={output.excerpt}>
                        {post.excerpt}
                      </Typography>
                    )}
                    {cardTheme.showMeta && <CardMeta post={post} sx={output.meta} />}
                    <Typography sx={{ opacity: 0.6, fontSize: '0.7rem', textAlign: 'center', mt: 1.5 }}>
                      悬停翻阅
                    </Typography>
                  </CardContent>
                </Box>
              </Box>
            </Paper>
          </ButtonBase>
        </Fade>
      );
    }

    // 原生默认主题在“横向列表”布局下：图片与文字左右排列（桌面端），移动端再堆叠
    return (
      <Fade in timeout={300} style={{ width: '100%', height: '100%' }}>
        <ButtonBase component={Link} to={`/post/${post.slug}`} sx={{
            width: '100%',
            height: '100%',
            display: 'block',
            textAlign: 'left',
            borderRadius: 1,
            transition: 'box-shadow 0.35s ease',
            '@media (hover: none) and (pointer: coarse)': {
              '&:active': {
                transform: 'scale(0.98)',
              },
            },
          }}>
          <Paper
            elevation={0}
            sx={{
              ...(output ? output.root : {}),
              display: 'flex',
              flexDirection: { xs: 'column', sm: index && index % 2 === 1 ? 'row-reverse' : 'row' },
              height: height ? '100%' : undefined,
              minHeight: height ? undefined : { xs: 280, sm: 340 },
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            {post.cover && (
              <Box
                sx={{
                  width: { xs: '100%', sm: '42%' },
                  height: height ? '100%' : { xs: 200, sm: 'auto' },
                  flexShrink: 0,
                  overflow: 'hidden',
                  backgroundColor: (theme) =>
                    theme.palette.mode === 'light'
                      ? alpha(theme.palette.primary.main, 0.12)
                      : alpha(theme.palette.primary.main, 0.22),
                  '& img': {
                    transition: 'transform 0.6s ease',
                  },
                }}
              >
                <LazyImage src={post.cover} alt={post.title} objectFit="cover" placeholder="skeleton" />
              </Box>
            )}
            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, px: { xs: 2, sm: 2.5 }, py: { xs: 1.5, sm: 2 } }}>
              <CardTags post={post} visible />
              <Typography className="post-card-title" variant="h6" component="h2" sx={{ ...(output?.title ?? {}), mb: 1, lineHeight: 1.35, fontSize: { xs: '1.125rem', sm: '1.35rem' }, overflowWrap: 'break-word' }}>
                {post.title}
              </Typography>
              <Typography variant="body2" sx={{ ...(output?.excerpt ?? {}), mb: 1.5, flexGrow: 0, lineHeight: 1.6, fontSize: { xs: '0.875rem', sm: '1rem' }, overflowWrap: 'break-word', overflow: 'hidden' }}>
                {post.excerpt}
              </Typography>
              <CardMeta post={post} sx={{ ...(output?.meta ?? {}), color: 'text.secondary' }} />
              <Box
                component="span"
                sx={{
                  alignSelf: 'flex-start',
                  mt: 1.5,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1.25,
                  py: 0.6,
                  borderRadius: 1.5,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  fontSize: { xs: '0.875rem', sm: '0.95rem' },
                  lineHeight: 1.25,
                  fontWeight: 500,
                  '& .card-action-arrow': { transition: 'transform 0.3s ease' },
                  '&:hover .card-action-arrow': { transform: 'translateX(4px)' },
                }}
              >
                阅读更多
                <span className="card-action-arrow" aria-hidden="true">
                  →
                </span>
              </Box>
            </CardContent>
          </Paper>
        </ButtonBase>
      </Fade>
    );
  }

  return (
    <Fade in timeout={300} style={{ width: '100%', height: '100%' }}>
      <ButtonBase component={Link} to={`/post/${post.slug}`} sx={{
            width: '100%',
            height: '100%',
            display: 'block',
            textAlign: 'left',
            borderRadius: 1,
            transition: 'box-shadow 0.35s ease',
            '@media (hover: none) and (pointer: coarse)': {
              '&:active': {
                transform: 'scale(0.98)',
              },
            },
          }}>
        <Paper
          elevation={0}
          sx={{
            position: 'relative',
            textDecoration: 'none',
            display: 'block',
            height: { xs: 380, sm: 420 },
            minWidth: 0,
            overflow: 'hidden',
            borderRadius: 1,
            transition: 'box-shadow 0.2s ease',
            '@media (hover: hover) and (pointer: fine)': {
              '&:hover': {
                boxShadow: (theme) =>
                  theme.palette.mode === 'light'
                    ? `0 8px 30px ${alpha(theme.palette.primary.main, 0.18)}`
                    : `0 8px 30px ${alpha(theme.palette.common.black, 0.35)}`,
              },
            },
          }}
        >
          {post.cover && (
            <>
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  '& img': {
                    transition: 'transform 0.6s ease',
                  },
                }}
              >
                <LazyImage src={post.cover} alt={post.title} objectFit="cover" placeholder="skeleton" />
              </Box>
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '50%',
                  bgcolor: 'background.paper',
                }}
              />
            </>
          )}
          <CardContent
            sx={{
              position: 'absolute',
              top: post.cover ? '50%' : 0,
              bottom: 0,
              left: 0,
              right: 0,
              display: 'flex',
              flexDirection: 'column',
              p: cardPaddingSx,
            }}
          >
            <CardTags post={post} visible />
            <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 1.5, lineHeight: 1.3, overflowWrap: 'break-word' }}>
              {post.title}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2, lineHeight: 1.7, fontSize: { xs: '0.875rem', sm: '1rem' }, overflowWrap: 'break-word', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {post.excerpt}
            </Typography>
            <CardMeta post={post} sx={{ color: 'text.secondary', mt: 'auto' }} />
          </CardContent>
        </Paper>
      </ButtonBase>
    </Fade>
  );
}

export function PostCardSkeleton() {
  const { config } = useSiteStore();
  const cardPadding = resolveSpacingConfig(config.spacing).cardPaddingY;
  return (
    <Paper elevation={0} sx={{ height: '100%', overflow: 'hidden', borderRadius: 1 }}>
      <Skeleton variant="rectangular" sx={{ height: { xs: 160, sm: 180, md: 200 } }} />
      <CardContent sx={{ p: { xs: cardPadding.mobile, sm: cardPadding.desktop } }}>
        <Skeleton variant="text" width="40%" sx={{ mb: 2 }} />
        <Skeleton variant="text" height={32} sx={{ mb: 1 }} />
        <Skeleton variant="text" height={20} sx={{ mb: 0.5 }} />
        <Skeleton variant="text" height={20} sx={{ mb: 0.5 }} />
        <Skeleton variant="text" width="60%" height={20} />
      </CardContent>
    </Paper>
  );
}
