import { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Typography, Chip, alpha, Skeleton } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getMessages } from '@/api/messages';
import type { Message } from '@/types/interaction';

const PAGE_SIZE = 50;

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const PICK_COUNT = 9;

function FlipCard({ message }: { message: Message }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <Box
      onClick={() => setFlipped(!flipped)}
      sx={{
        width: 200,
        height: 260,
        perspective: 1000,
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* 卡片背面（未翻牌） */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            borderRadius: 1,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
            border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            p: 2,
          }}
        >
          <Typography variant="h4" sx={{ opacity: 0.4, userSelect: 'none' }}>
            ?
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
            点击翻开
          </Typography>
        </Box>

        {/* 卡片正面（翻牌后） */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            borderRadius: 1,
            bgcolor: 'background.paper',
            border: (theme) => `1px solid ${theme.palette.divider}`,
            display: 'flex',
            flexDirection: 'column',
            p: 2,
            overflow: 'hidden',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
            {message.userId ? (
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {message.username || '用户'}
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
                {message.nickname && (
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                    {message.nickname}
                  </Typography>
                )}
              </>
            )}
          </Box>
          <Typography
            variant="body2"
            sx={{
              flex: 1,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: 1.6,
              fontSize: '0.8rem',
            }}
          >
            {message.content}
          </Typography>
          <Typography variant="caption" color="text.disabled" sx={{ mt: 1, fontSize: '0.65rem' }}>
            {new Date(message.createdAt).toLocaleDateString('zh-CN')}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default function FlipCardStyle() {
  const [pool, setPool] = useState<Message[]>([]);
  const [cards, setCards] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [batch, setBatch] = useState(0);

  
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let page = 1;
      let total = 0;
      const all: Message[] = [];
      
      const first = await getMessages(1, PAGE_SIZE);
      if (cancelled) return;
      const firstList = first.code === 0 && first.data ? first.data.list : [];
      total = first.data?.total ?? firstList.length;
      all.push(...firstList);
      setPool([...all]);
      setCards(shuffleArray(all).slice(0, PICK_COUNT));
      setLoading(false);
      setBatch((b) => b + 1); 
      
      page = 2;
      while (all.length < total) {
        const res = await getMessages(page, PAGE_SIZE);
        if (cancelled) return;
        const list = res.code === 0 && res.data ? res.data.list : [];
        if (list.length === 0) break;
        all.push(...list);
        setPool([...all]);
        page += 1;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  
  const pickCards = useCallback(() => {
    setCards(shuffleArray(pool).slice(0, PICK_COUNT));
    setBatch((b) => b + 1);
  }, [pool]);

  const shuffled = useMemo(() => shuffleArray(cards), [cards]);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mb: 2 }}>
        <Box
          component="span"
          onClick={pickCards}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1.5,
            py: 0.5,
            borderRadius: (theme) => `max(8px, ${theme.shape.borderRadius}px - 4px)`,
            cursor: 'pointer',
            color: 'text.secondary',
            fontSize: '0.85rem',
            fontWeight: 600,
            '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08) },
          }}
        >
          <RefreshIcon sx={{ fontSize: 16 }} />
          换一批
        </Box>
      </Box>
      <Box
        key={batch}
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          justifyContent: 'center',
          '@keyframes msgwall-flipcard-in': {
            '0%': { opacity: 0, transform: 'translateY(18px) scale(0.94)' },
            '100%': { opacity: 1, transform: 'translateY(0) scale(1)' },
          },
        }}
      >
        {loading ? (
          Array.from({ length: PICK_COUNT }).map((_, i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              width={200}
              height={260}
              sx={{ borderRadius: 1, flexShrink: 0 }}
            />
          ))
        ) : shuffled.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
            暂无留言
          </Typography>
        ) : (
          shuffled.map((msg, i) => (
            <Box
              key={msg.id}
              sx={{
                animation: 'msgwall-flipcard-in 0.45s cubic-bezier(0.4, 0, 0.2, 1) both',
                animationDelay: `${i * 60}ms`,
              }}
            >
              <FlipCard message={msg} />
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}
