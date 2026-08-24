import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Drawer,
  Fab,
  Typography,
  alpha,
  useTheme,
  Tooltip,
} from '@mui/material';
import { MenuBook, Close } from '@mui/icons-material';
import { smoothScrollTo } from '@/utils/smoothScrollController';

export interface HeadingItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
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

export function TableOfContents({ headings }: TableOfContentsProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>('');
  const listRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  const hasHeadings = headings.length > 0;

  
  useEffect(() => {
    if (!hasHeadings) return;

    const container = getScrollContainer();
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .map((e) => e.target.id);
        if (visible.length > 0) {
          setActiveId(visible[0]);
        }
      },
      {
        root: container,
        rootMargin: '-64px 0px -70% 0px',
        threshold: 0,
      }
    );

    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });

    
    const init = () => {
      const scrollTop = container.scrollTop;
      let current = headings[0]?.id || '';
      for (const h of headings) {
        const top = getHeadingTop(h.id);
        if (top !== null && top <= scrollTop + 80) {
          current = h.id;
        }
      }
      setActiveId(current);
    };
    init();

    return () => observer.disconnect();
  }, [headings, hasHeadings]);

  
  useEffect(() => {
    if (open && activeItemRef.current && listRef.current) {
      const list = listRef.current;
      const item = activeItemRef.current;
      const listRect = list.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const offset = itemRect.top - listRect.top - listRect.height / 2 + itemRect.height / 2;
      list.scrollTo({ top: list.scrollTop + offset, behavior: 'smooth' });
    }
  }, [open]);

  const handleClick = (id: string) => {
    const container = getScrollContainer();
    if (!container) return;

    setOpen(false);

    const computeTarget = (): number | null => {
      const el = document.getElementById(id);
      if (!container || !el) return null;
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const top = container.scrollTop + (elRect.top - containerRect.top);
      return Math.max(0, top - 24);
    };

    const target = computeTarget();
    if (target === null) return;

    
    if (smoothScrollTo(target)) return;

    
    
    
    window.setTimeout(() => {
      const finalTarget = computeTarget();
      if (finalTarget !== null) {
        container.scrollTop = finalTarget;
      }
    }, 260);
  };

  if (!hasHeadings) return null;

  return (
    <>
      <Tooltip title="目录" arrow placement="left">
        <Fab
          size="medium"
          aria-label="打开目录"
          onClick={() => setOpen(true)}
          sx={{
            position: 'fixed',
            right: { xs: 16, sm: 24 },
            top: { xs: 80, sm: 96 },
            zIndex: 1500,
            bgcolor: 'background.paper',
            color: 'primary.main',
            opacity: 0.2,
            boxShadow: (t) =>
              t.palette.mode === 'light'
                ? `0 4px 20px ${alpha(t.palette.primary.main, 0.2)}`
                : `0 4px 20px ${alpha(t.palette.common.black, 0.4)}`,
            transition: (t) =>
              t.transitions.create(['transform', 'box-shadow', 'background-color', 'opacity'], {
                duration: t.transitions.duration.short,
              }),
            '&:hover': {
              bgcolor: 'background.paper',
              opacity: 0.6,
              transform: 'scale(1.08)',
              boxShadow: (t) =>
                t.palette.mode === 'light'
                  ? `0 6px 28px ${alpha(t.palette.primary.main, 0.3)}`
                  : `0 6px 28px ${alpha(t.palette.common.black, 0.5)}`,
            },
          }}
        >
          <MenuBook />
        </Fab>

      </Tooltip>


      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        disableScrollLock
        PaperProps={{
          sx: {
            width: { xs: '80vw', sm: 320 },
            maxWidth: 360,
            borderRadius: 0,
            bgcolor: 'background.paper',
            backgroundImage: 'none',
            boxShadow: (t) =>
              t.palette.mode === 'light'
                ? `-8px 0 40px ${alpha(t.palette.primary.main, 0.1)}`
                : `-8px 0 40px ${alpha(t.palette.common.black, 0.3)}`,
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="subtitle1" fontWeight={700}>
            目录
          </Typography>

          <Box
            component="button"
            onClick={() => setOpen(false)}
            aria-label="关闭目录"
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 1,
              border: 'none',
              bgcolor: 'transparent',
              color: 'text.secondary',
              cursor: 'pointer',
              transition: (t) =>
                t.transitions.create(['background-color', 'color'], {
                  duration: t.transitions.duration.short,
                }),
              '&:hover': {
                bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                color: 'primary.main',
              },
            }}
          >
            <Close fontSize="small" />
          </Box>

        </Box>


        <Box
          ref={listRef}
          sx={{
            flex: 1,
            overflowY: 'auto',
            py: 1,
            px: 1.5,
          }}
        >
          {headings.map((h) => {
            const isActive = activeId === h.id;
            return (
              <Box
                key={h.id}
                component="button"
                ref={isActive ? activeItemRef : null}
                onClick={() => handleClick(h.id)}
                sx={{
                  width: '100%',
                  display: 'block',
                  textAlign: 'left',
                  px: 1.5,
                  py: 0.75,
                  mb: 0.25,
                  border: 'none',
                  borderRadius: 1,
                  bgcolor: isActive
                    ? alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.1 : 0.15)
                    : 'transparent',
                  color: isActive ? 'primary.main' : 'text.secondary',
                  fontSize: '0.875rem',
                  lineHeight: 1.5,
                  cursor: 'pointer',
                  pl: `${1.5 + (h.level - 1) * 1.25}rem`,
                  transition: (t) =>
                    t.transitions.create(['background-color', 'color', 'padding-left'], {
                      duration: t.transitions.duration.short,
                    }),
                  '&:hover': {
                    bgcolor: (t) =>
                      alpha(t.palette.primary.main, t.palette.mode === 'light' ? 0.08 : 0.12),
                    color: isActive ? 'primary.main' : 'text.primary',
                  },
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: isActive ? 600 : 400,
                    lineHeight: 1.5,
                    overflowWrap: 'break-word',
                  }}
                >
                  {h.text}
                </Typography>

              </Box>

            );
          })}
        </Box>

      </Drawer>

    </>

  );
}
