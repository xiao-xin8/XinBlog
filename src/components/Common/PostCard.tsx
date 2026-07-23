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
  const output = buildPostCardOutput(cardTheme, {
    post,
    config,
    themeColor: activeColors.primary,
    borderRadius: config.theme?.borderRadius ?? 16,
  });

  if (output) {
    const mediaAsBackground = output.mediaAsBackground ?? output.layout === 'overlay';
    const rootSx = height ? { ...output.root, height } : output.root;

    return (
      <Fade in timeout={300} style={{ height: '100%' }}>
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
                  <Typography variant="h5" component="h2" sx={output.title}>
                    {post.title}
                  </Typography>
                  {cardTheme.showExcerpt && (
                    <Typography variant="body1" sx={output.excerpt}>
                      {post.excerpt}
                    </Typography>
                  )}
                  {cardTheme.showMeta && <CardMeta post={post} sx={output.meta} />}
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
    
    return (
      <Fade in timeout={300} style={{ height: '100%' }}>
        <ButtonBase component={Link} to={`/post/${post.slug}`} sx={{
            width: '100%',
            height: '100%',
            display: 'block',
            textAlign: 'left',
            borderRadius: 1,
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            '@media (hover: hover) and (pointer: fine)': {
              '&:hover': {
                transform: 'translateY(-4px)',
              },
            },
            '@media (hover: none) and (pointer: coarse)': {
              '&:active': {
                transform: 'scale(0.98)',
              },
            },
          }}>
          <Paper
            elevation={0}
            sx={{
              textDecoration: 'none',
              display: 'flex',
              flexDirection: { xs: 'column', sm: index && index % 2 === 1 ? 'row-reverse' : 'row' },
              height: height ? '100%' : undefined,
              minHeight: height ? undefined : { xs: 280, sm: 320 },
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
              <Box
                sx={{
                  width: { xs: '100%', sm: '42%' },
                  height: height ? '100%' : { xs: 200, sm: 'auto' },
                  flexShrink: 0,
                  overflow: 'hidden',
                  '& img': {
                    transition: 'transform 0.3s ease',
                  },
                }}
              >
                <LazyImage src={post.cover} alt={post.title} objectFit="cover" placeholder="skeleton" />
              </Box>
            )}
            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: { xs: 2, sm: 3 } }}>
              <CardTags post={post} visible />
              <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 1.5, lineHeight: 1.3, overflowWrap: 'break-word' }}>
                {post.title}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ flexGrow: 1, mb: 2, lineHeight: 1.7, fontSize: { xs: '0.875rem', sm: '1rem' }, overflowWrap: 'break-word', overflow: 'hidden' }}>
                {post.excerpt}
              </Typography>
              <CardMeta post={post} sx={{ color: 'text.secondary' }} />
            </CardContent>
          </Paper>
        </ButtonBase>
      </Fade>
    );
  }

  return (
    <Fade in timeout={300} style={{ height: '100%' }}>
      <ButtonBase component={Link} to={`/post/${post.slug}`} sx={{
            width: '100%',
            height: '100%',
            display: 'block',
            textAlign: 'left',
            borderRadius: 1,
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            '@media (hover: hover) and (pointer: fine)': {
              '&:hover': {
                transform: 'translateY(-4px)',
              },
            },
            '@media (hover: none) and (pointer: coarse)': {
              '&:active': {
                transform: 'scale(0.98)',
              },
            },
          }}>
        <Paper
          elevation={0}
          sx={{
            textDecoration: 'none',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: { xs: 380, sm: 420 },
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
            <Box
              sx={{
                width: '100%',
                height: { xs: 160, sm: 180, md: 200 },
                borderRadius: (theme) => `${theme.shape.borderRadius}px ${theme.shape.borderRadius}px 0 0`,
                overflow: 'hidden',
                '& img': {
                  transition: 'transform 0.3s ease',
                },
              }}
            >
              <LazyImage src={post.cover} alt={post.title} objectFit="cover" placeholder="skeleton" />
            </Box>
          )}
          <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: { xs: 2, sm: 3 } }}>
            <CardTags post={post} visible />
            <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 1.5, lineHeight: 1.3, overflowWrap: 'break-word' }}>
              {post.title}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ flexGrow: 1, mb: 2, lineHeight: 1.7, fontSize: { xs: '0.875rem', sm: '1rem' }, overflowWrap: 'break-word', overflow: 'hidden' }}>
              {post.excerpt}
            </Typography>
            <CardMeta post={post} sx={{ color: 'text.secondary' }} />
          </CardContent>
        </Paper>
      </ButtonBase>
    </Fade>
  );
}

export function PostCardSkeleton() {
  return (
    <Paper elevation={0} sx={{ height: '100%', overflow: 'hidden', borderRadius: 1 }}>
      <Skeleton variant="rectangular" sx={{ height: { xs: 160, sm: 180, md: 200 } }} />
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Skeleton variant="text" width="40%" sx={{ mb: 2 }} />
        <Skeleton variant="text" height={32} sx={{ mb: 1 }} />
        <Skeleton variant="text" height={20} sx={{ mb: 0.5 }} />
        <Skeleton variant="text" height={20} sx={{ mb: 0.5 }} />
        <Skeleton variant="text" width="60%" height={20} />
      </CardContent>
    </Paper>
  );
}
