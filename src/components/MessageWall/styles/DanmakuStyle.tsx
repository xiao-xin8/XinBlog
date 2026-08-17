import { useRef, useEffect, useState } from 'react';
import { Box, Typography, Chip, alpha, Skeleton } from '@mui/material';
import { getMessages } from '@/api/messages';
import type { Message } from '@/types/interaction';

const PAGE_SIZE = 100;

const COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff8fb1', '#a66cff', '#ff9f43', '#00d2d3'];


const TRACKS = 12;

const MIN_SPEED = 8;
const MAX_SPEED = 11;


const MIN_INTERVAL = 6;
const MAX_INTERVAL = 10;

const MAX_LEN = 50;


function truncate(content: string) {
  return content.length > MAX_LEN ? `${content.slice(0, MAX_LEN)}…` : content;
}

interface ActiveDanmaku extends Message {
  uid: string;
  track: number;
  duration: number;
  color: string;
}

export default function DanmakuStyle() {
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ActiveDanmaku[]>([]);
  
  const allRef = useRef<Message[]>([]);
  
  const trackSpeedsRef = useRef(
    Array.from({ length: TRACKS }, () => MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED))
  );

  
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all: Message[] = [];
      let page = 1;
      for (;;) {
        const res = await getMessages(page, PAGE_SIZE);
        if (cancelled) return;
        const list = res.code === 0 && res.data ? res.data.list : [];
        if (list.length === 0) break;
        all.push(...list);
        const total = res.data?.total || 0;
        if (all.length >= total) break;
        page += 1;
      }
      if (cancelled) return;
      allRef.current = all;
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  
  useEffect(() => {
    if (loading) return;
    let stopped = false;
    const timers: number[] = [];
    let cursor = 0;

    const loop = (track: number) => {
      if (stopped) return;
      const all = allRef.current;
      if (all.length === 0) {
        timers.push(window.setTimeout(() => loop(track), 3000));
        return;
      }
      const msg = all[cursor % all.length];
      cursor += 1;
      const duration = trackSpeedsRef.current[track];
      const uid = `${msg.id}-${Date.now()}-${track}-${cursor}`;
      setActive((prev) => [
        ...prev,
        { ...msg, uid, track, duration, color: COLORS[track % COLORS.length] },
      ]);
      timers.push(
        window.setTimeout(() => {
          setActive((prev) => prev.filter((a) => a.uid !== uid));
        }, duration * 1000 + 300)
      );
      const interval = (MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL)) * 1000;
      timers.push(window.setTimeout(() => loop(track), interval));
    };

    
    for (let track = 0; track < TRACKS; track++) {
      timers.push(window.setTimeout(() => loop(track), Math.random() * 4000));
    }

    return () => {
      stopped = true;
      timers.forEach(clearTimeout);
    };
  }, [loading]);

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: 420,
        overflow: 'hidden',
        borderRadius: 1,
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.03),
        border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
      }}
    >
      {loading ? (
        <Box sx={{ p: 2 }}>
          <Skeleton variant="rectangular" height={380} sx={{ borderRadius: 1 }} />
        </Box>
      ) : allRef.current.length === 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Typography variant="body2" color="text.secondary">
            暂无留言
          </Typography>
        </Box>
      ) : (
        <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
          {active.map((item) => (
            <Box
              key={item.uid}
              sx={{
                position: 'absolute',
                whiteSpace: 'nowrap',
                top: `${item.track * 8 + 2}%`,
                animation: `msgwall-danmaku-scroll ${item.duration}s linear forwards`,
                animationFillMode: 'both',
                '@keyframes msgwall-danmaku-scroll': {
                  '0%': { transform: 'translateX(100vw)', opacity: 0 },
                  '2%': { opacity: 1 },
                  '90%': { opacity: 1 },
                  '100%': { transform: 'translateX(-100%)', opacity: 0 },
                },
              }}
            >
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '999px',
                  bgcolor: (theme) => alpha(item.color, theme.palette.mode === 'light' ? 0.12 : 0.25),
                  backdropFilter: 'blur(4px)',
                  border: `1px solid ${alpha(item.color, 0.25)}`,
                }}
              >
                {item.userId ? (
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 700, color: item.color, flexShrink: 0 }}
                  >
                    {item.username || '用户'}
                  </Typography>
                ) : (
                  <>
                    <Chip
                      label="访客"
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        borderRadius: 0.5,
                        bgcolor: (theme) => alpha(theme.palette.text.secondary, 0.1),
                        color: 'text.secondary',
                      }}
                    />
                    {item.nickname && (
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 700, color: 'text.secondary', flexShrink: 0 }}
                      >
                        {item.nickname}
                      </Typography>
                    )}
                  </>
                )}
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.primary',
                    fontWeight: 500,
                    maxWidth: 260,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {truncate(item.content)}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
