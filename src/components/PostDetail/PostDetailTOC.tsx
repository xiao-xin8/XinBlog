import { useEffect, useState } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import type { HeadingItem } from '@/components/Post/TableOfContents';

interface PostDetailTOCProps {
  headings: HeadingItem[];
}

function getScrollContainer(): HTMLElement | null {
  return document.querySelector('main') as HTMLElement | null;
}



function getHeadingTop(id: string): number | null {
  const container = getScrollContainer();
  const el = document.getElementById(id);
  if (!container || !el) return null;
  const containerRect = container.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  return container.scrollTop + (elRect.top - containerRect.top);
}

function cleanHeadingText(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
}

export function PostDetailTOC({ headings }: PostDetailTOCProps) {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    if (headings.length === 0) return;
    const container = getScrollContainer();
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const offset = 150;
      let currentActiveId = '';
      for (const h of headings) {
        const top = getHeadingTop(h.id);
        if (top !== null && top <= scrollTop + offset) {
          currentActiveId = h.id;
        }
      }
      if (currentActiveId) setActiveId(currentActiveId);
    };

    handleScroll();
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [headings]);

  const handleClick = (id: string) => {
    const top = getHeadingTop(id);
    const container = getScrollContainer();
    if (top === null || !container) return;
    container.scrollTo({ top: Math.max(0, top - 24), behavior: 'smooth' });
    setActiveId(id);
  };

  if (headings.length === 0) return null;

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 28,
        maxHeight: '75vh',
        overflowY: 'auto',
        p: 3,
        borderRadius: 1,
        bgcolor: (t) =>
          t.palette.mode === 'light' ? 'rgba(255,255,255,0.6)' : 'rgba(30,41,59,0.5)',
        backdropFilter: 'blur(16px)',
        border: (t) => `1px solid ${alpha(t.palette.divider, 0.5)}`,
        boxShadow: (t) =>
          t.palette.mode === 'light'
            ? '0 10px 30px rgba(0,0,0,0.06)'
            : '0 10px 30px rgba(0,0,0,0.2)',
        transition: 'all 0.3s ease',
        scrollbarWidth: 'thin',
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 900,
          mb: 2,
          pl: 1.5,
          borderLeft: '4px solid',
          borderColor: 'primary.main',
          color: 'text.primary',
          letterSpacing: '0.05em',
        }}
      >
        TABLE OF CONTENTS
      </Typography>

      <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '2px',
            bgcolor: (t) => alpha(t.palette.divider, 0.5),
            borderRadius: '999px',
          }}
        />
        {headings.map((h) => {
          const isActive = activeId === h.id;
          return (
            <Box
              key={h.id}
              component="button"
              onClick={() => handleClick(h.id)}
              sx={{
                position: 'relative',
                textAlign: 'left',
                pl: 2,
                py: 0.5,
                ml: `${(h.level - 1) * 12}px`,
                border: 'none',
                bgcolor: 'transparent',
                color: isActive ? 'primary.main' : 'text.secondary',
                fontSize: h.level === 1 ? '0.875rem' : '0.8125rem',
                fontWeight: isActive ? 700 : 500,
                lineHeight: 1.5,
                cursor: 'pointer',
                borderRadius: 1,
                transition: 'all 0.3s ease',
                transform: isActive ? 'scale(1.03)' : 'scale(1)',
                transformOrigin: 'left center',
                '&:hover': {
                  color: 'primary.main',
                },
              }}
            >
              {isActive && (
                <Box
                  sx={{
                    position: 'absolute',
                    left: '-3px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    boxShadow: (t) => `0 0 8px ${alpha(t.palette.primary.main, 0.8)}`,
                  }}
                />
              )}
              <Typography
                variant="inherit"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {cleanHeadingText(h.text)}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
