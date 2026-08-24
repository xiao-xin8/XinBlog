import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import type { HeroWidgetConfig } from '@/types';

interface ClockWidgetPropsFromConfig {
  format?: '24h' | '12h';
  showSeconds?: boolean;
  showDate?: boolean;
}

function formatTime(date: Date, format: '24h' | '12h', showSeconds: boolean): string {
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  let suffix = '';
  if (format === '12h') {
    suffix = hours >= 12 ? ' PM' : ' AM';
    hours = hours % 12 || 12;
  }
  const h = String(hours).padStart(2, '0');
  return showSeconds ? `${h}:${minutes}:${seconds}${suffix}` : `${h}:${minutes}${suffix}`;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
  return `${y}年${m}月${d}日 ${week}`;
}

function formatShortDate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
  return `${m}/${d} ${week}`;
}

export function ClockWidget({ config }: { config: HeroWidgetConfig }) {
  const props = (config.props || {}) as ClockWidgetPropsFromConfig;
  const format = props.format || '24h';
  const showSeconds = props.showSeconds === true;
  const showDate = props.showDate !== false;
  const [now, setNow] = useState(new Date());

  
  const { w, h } = config;
  const isTiny = w === 1 && h === 1;
  const isTall = w === 1 && h >= 2;
  const isWide = h === 1 && w >= 2;
  const isCompact = (w === 2 && h === 2) || isWide;
  const isLarge = w >= 3 && h >= 2;
  const timeVariant = isTiny ? 'h5' : isWide ? 'h4' : 'h3';
  const displaySeconds = showSeconds && (isLarge || isTall);
  const displayDate = showDate && !isTiny;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
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
        alignItems: isTall ? 'center' : 'flex-start',
        gap: 0.5,
        overflow: 'hidden',
      }}
    >
      <Typography
        variant={timeVariant as 'h3' | 'h4' | 'h5'}
        sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}
      >
        {formatTime(now, format, displaySeconds)}
      </Typography>

      {displayDate && (
        <Typography variant={isCompact ? 'caption' : 'body2'} color="text.secondary" noWrap>
          {isCompact ? formatShortDate(now) : formatDate(now)}
        </Typography>

      )}
    </Box>

  );
}
