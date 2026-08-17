import { useEffect, useState } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import { FormatQuote } from '@mui/icons-material';
import type { HeroWidgetConfig } from '@/types';

interface HitokotoData {
  hitokoto: string;
  from: string;
  from_who: string | null;
}

export function HitokotoWidget({ config }: { config: HeroWidgetConfig }) {
  const [data, setData] = useState<HitokotoData | null>(null);
  const [loading, setLoading] = useState(true);

  
  const { w, h } = config;
  const isTiny = w === 1 && h === 1;
  const isWide = h === 1 && w >= 2;
  const quoteVariant = isTiny ? 'body2' : isWide ? 'body1' : 'h6';
  const lineClamp = isTiny ? 2 : isWide ? 2 : h >= 3 ? 6 : 4;
  const showSource = !isTiny && !isWide;

  useEffect(() => {
    let cancelled = false;
    fetch('https://v1.hitokoto.cn?encode=json')
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData({ hitokoto: '人生如逆旅，我亦是行人。', from: '苏轼', from_who: null });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 1,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <FormatQuote
        sx={{
          position: 'absolute',
          top: 8,
          left: 8,
          fontSize: isTiny ? 28 : 40,
          color: (theme) => alpha(theme.palette.primary.main, 0.15),
        }}
      />
      <Typography
        variant={quoteVariant as 'body2' | 'body1' | 'h6'}
        sx={{
          fontWeight: 600,
          lineHeight: 1.5,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: lineClamp,
          WebkitBoxOrient: 'vertical',
          pl: 3,
        }}
      >
        {loading ? '正在加载一言...' : data?.hitokoto}
      </Typography>
      {!loading && data && showSource && (
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>
          —— {data.from_who || ''}《{data.from}》
        </Typography>
      )}
    </Box>
  );
}
