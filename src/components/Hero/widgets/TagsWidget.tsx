import { useEffect, useState } from 'react';
import { Box, Chip, Typography, alpha } from '@mui/material';
import { LocalOffer } from '@mui/icons-material';
import { fetchTags } from '@/api/posts';
import { useHeroEditContext } from '@/components/Hero/HeroEditContext';
import type { HeroWidgetConfig, Tag } from '@/types';

interface TagsWidgetPropsFromConfig {
  limit?: number;
  showCount?: boolean;
}

export function TagsWidget({ config }: { config: HeroWidgetConfig }) {
  const props = (config.props || {}) as TagsWidgetPropsFromConfig;
  const { editable } = useHeroEditContext();
  const limit = props.limit || 20;
  const showCount = props.showCount !== false;
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  
  const { w, h } = config;
  const isTiny = w === 1 && h === 1;
  const isTall = w === 1 && h >= 2;
  const isWide = h === 1 && w >= 2;
  const isCompact = (w === 2 && h === 2) || isWide;
  const displayLimit = isTiny ? 4 : isTall ? h * 3 : isCompact ? 6 : isWide ? 5 : limit;
  const chipHeight = isTiny || isTall ? 20 : 24;
  const chipFontSize = isTiny || isTall ? 9 : 11;

  useEffect(() => {
    let cancelled = false;
    fetchTags()
      .then((res) => {
        if (!cancelled) setTags(res.slice(0, displayLimit));
      })
      .catch(() => {
        if (!cancelled) setTags([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [displayLimit]);

  const getChipProps = (tag: Tag) =>
    editable
      ? { component: 'div' as const }
      : { component: 'a' as const, href: `/tag/${tag.slug}` };

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
        <LocalOffer fontSize="small" color="primary" />
        <Typography variant="subtitle2" fontWeight={700}>
          文章标签
        </Typography>
      </Box>

      {loading ? (
        <Typography variant="body2" color="text.secondary">
          加载中...
        </Typography>
      ) : tags.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          暂无标签
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignContent: 'flex-start', overflow: 'hidden' }}>
          {tags.map((tag) => (
            <Chip
              key={tag.id}
              {...getChipProps(tag)}
              label={showCount ? `${tag.name} ${tag.count ?? 0}` : tag.name}
              size="small"
              sx={{
                height: chipHeight,
                fontSize: chipFontSize,
                borderRadius: 1,
                textDecoration: 'none',
                bgcolor: tag.color ? `${tag.color}20` : (theme) => alpha(theme.palette.primary.main, 0.1),
                color: tag.color || 'primary.main',
                fontWeight: 600,
                '&:hover': {
                  bgcolor: tag.color ? `${tag.color}35` : (theme) => alpha(theme.palette.primary.main, 0.2),
                },
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
