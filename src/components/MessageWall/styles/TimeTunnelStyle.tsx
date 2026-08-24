import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Box, Typography, Chip, alpha, CircularProgress } from '@mui/material';
import { getMessages } from '@/api/messages';
import type { Message } from '@/types/interaction';

const PAGE_SIZE = 50;

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TimeTunnelStyle() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);

  const loadPage = useCallback(async (p: number, append: boolean) => {
    const res = await getMessages(p, PAGE_SIZE);
    const list = res.code === 0 && res.data ? res.data.list : [];
    const t = res.data?.total || 0;
    setPage(p);
    setMessages((prev) => (append ? [...prev, ...list] : list));
    if (list.length < PAGE_SIZE || p * PAGE_SIZE >= t) setAllLoaded(true);
  }, []);

  
  useEffect(() => {
    setAllLoaded(false);
    setLoading(true);
    loadPage(1, false).finally(() => setLoading(false));
  }, [loadPage]);

  
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const state = { target: el.scrollLeft, current: el.scrollLeft, rafId: 0 };

    const clampTarget = (v: number) =>
      Math.max(0, Math.min(v, el.scrollWidth - el.clientWidth));

    const render = () => {
      const diff = state.target - state.current;
      if (Math.abs(diff) < 0.5) {
        state.current = state.target;
        el.scrollLeft = state.current;
        state.rafId = 0;
        setIsScrolling(false);
        return;
      }
      state.current += diff * 0.16;
      el.scrollLeft = state.current;
      state.rafId = requestAnimationFrame(render);
    };

    const startRender = () => {
      if (!state.rafId) {
        setIsScrolling(true);
        state.rafId = requestAnimationFrame(render);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      
      e.preventDefault();
      e.stopPropagation();
      state.target += e.deltaY || e.deltaX;
      state.target = clampTarget(state.target);
      startRender();
    };

    
    let touchStartX = 0;
    let touchStartY = 0;
    let touchAnchor = state.target;
    let draggingX = false;

    const handleTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchAnchor = state.target;
      draggingX = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      
      if (!draggingX) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
          draggingX = true;
          e.preventDefault();
          e.stopPropagation();
        } else {
          return;
        }
      }
      e.preventDefault();
      e.stopPropagation();
      state.target = clampTarget(touchAnchor - dx);
      startRender();
    };

    const endDrag = () => {
      draggingX = false;
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', endDrag);
    el.addEventListener('touchcancel', endDrag);
    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', endDrag);
      el.removeEventListener('touchcancel', endDrag);
      cancelAnimationFrame(state.rafId);
    };
  }, []);

  
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 200) {
      if (!allLoaded && !loadingMore) {
        setLoadingMore(true);
        loadPage(page + 1, true).finally(() => setLoadingMore(false));
      }
    }
  };

  
  const groups = useMemo(() => {
    const map = new Map<string, Message[]>();
    messages.forEach((m) => {
      const key = new Date(m.createdAt).toLocaleDateString('zh-CN');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    });
    return [...map.entries()];
  }, [messages]);

  return (
    <Box
      sx={{
        position: 'relative',
        borderRadius: 1,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.02),
        overflow: 'hidden',
      }}
    >
      {}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
          zIndex: 1,
        }}
      />

      <Box
        ref={scrollRef}
        onScroll={handleScroll}
        sx={{
          display: 'flex',
          gap: 3,
          p: 3,
          overflow: 'hidden',
          cursor: isScrolling ? 'grabbing' : 'grab',
          minHeight: 300,
          alignItems: 'flex-start',
          '@keyframes msgwall-tunnel-in': {
            '0%': { opacity: 0, transform: 'translateY(16px)' },
            '100%': { opacity: 1, transform: 'translateY(0)' },
          },
          '&::-webkit-scrollbar': { height: 6 },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
            borderRadius: 3,
          },
        }}
      >
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: 260,
              gap: 1.5,
            }}
          >
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              加载中...
            </Typography>

          </Box>

        ) : groups.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: 260,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              暂无留言
            </Typography>

          </Box>

        ) : (
          groups.map(([date, msgs], i) => (
            <Box
              key={date}
              sx={{
                flexShrink: 0,
                width: 240,
                
                animation: 'msgwall-tunnel-in 0.5s cubic-bezier(0.4, 0, 0.2, 1) both',
                animationDelay: `${Math.min(i, 8) * 70}ms`,
              }}
            >
              {}
              <Box
                sx={{
                  position: 'relative',
                  mb: 2,
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: -28,
                    left: 16,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    border: (theme) => `2px solid ${theme.palette.background.paper}`,
                    zIndex: 2,
                  },
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    color: 'primary.main',
                    display: 'block',
                    mb: 0.5,
                    pl: 0.5,
                  }}
                >
                  {date}
                </Typography>

                <Typography
                  variant="caption"
                  color="text.disabled"
                  sx={{ display: 'block', pl: 0.5, fontSize: '0.65rem' }}
                >
                  {msgs.length} 条留言
                </Typography>

              </Box>


              {}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {msgs.map((msg) => (
                  <Box
                    key={msg.id}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: 'background.paper',
                      border: (theme) => `1px solid ${theme.palette.divider}`,
                      transition: 'box-shadow 0.2s, transform 0.2s',
                      '&:hover': {
                        boxShadow: (theme) => `0 4px 12px ${alpha(theme.palette.common.black, 0.08)}`,
                        transform: 'translateY(-2px)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, flexWrap: 'wrap' }}>
                      {msg.userId ? (
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          {msg.username || '用户'}
                        </Typography>

                      ) : (
                        <>
                          <Chip
                            label="访客"
                            size="small"
                            sx={{
                              height: 16,
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              borderRadius: 0.5,
                              bgcolor: (theme) => alpha(theme.palette.text.secondary, 0.1),
                              color: 'text.secondary',
                            }}
                          />
                          {msg.nickname && (
                            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                              {msg.nickname}
                            </Typography>

                          )}
                        </>

                      )}
                      <Typography
                        variant="caption"
                        color="text.disabled"
                        sx={{ ml: 'auto', fontSize: '0.6rem' }}
                      >
                        {formatTime(msg.createdAt)}
                      </Typography>

                    </Box>

                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: '0.8rem',
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        display: '-webkit-box',
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {msg.content}
                    </Typography>

                  </Box>

                ))}
              </Box>

            </Box>

          ))
        )}

        {}
        {!loading && groups.length > 0 && (
          <Box
            sx={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 120,
              minHeight: 260,
            }}
          >
            {loadingMore ? (
              <CircularProgress size={22} />
            ) : allLoaded ? (
              <Typography variant="caption" color="text.disabled">
                已到尽头
              </Typography>

            ) : (
              <Typography variant="caption" color="text.disabled">
                继续滚动...
              </Typography>

            )}
          </Box>

        )}
      </Box>


      <Box
        sx={{
          textAlign: 'center',
          py: 1,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.03),
        }}
      >
        <Typography variant="caption" color="text.disabled">
          滚动或滑动浏览时间轴
        </Typography>

      </Box>

    </Box>

  );
}
