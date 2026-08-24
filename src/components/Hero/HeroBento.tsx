import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, IconButton, useMediaQuery, useTheme, alpha } from '@mui/material';
import { Edit, DeleteOutline, OpenWith, PhoneAndroid } from '@mui/icons-material';
import type { HeroConfig, HeroWidgetConfig } from '@/types';
import { fillHeroWidgetProps, getHeroWidgetDefinition } from './heroWidgetRegistry';
import { HeroEditContext } from './HeroEditContext';

interface HeroBentoProps {
  hero: HeroConfig;
  editable?: boolean;
  onChange?: (widgets: HeroWidgetConfig[]) => void;
  onEdit?: (widget: HeroWidgetConfig) => void;
  onDelete?: (widget: HeroWidgetConfig) => void;
}

interface DragState {
  id: string;
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
  initialW: number;
  initialH: number;
  offsetX: number;
  offsetY: number;
}

const FIXED_COLS = 6;
const GAP = 16;
const MIN_ROWS = 4;

function WidgetGlassCard({
  children,
  opacity,
  editable,
  isDragging,
  hideOnMobile,
  onMouseDown,
  onEdit,
  onDelete,
  title,
}: {
  children: React.ReactNode;
  opacity: number;
  editable?: boolean;
  isDragging?: boolean;
  hideOnMobile?: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  title?: string;
}) {
  const theme = useTheme();
  return (
    <Box
      onMouseDown={onMouseDown}
      className="hero-widget-card"
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 0,
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: (theme) => alpha(theme.palette.background.paper, opacity * (theme.palette.mode === 'light' ? 0.72 : 0.64)),
        backdropFilter: 'blur(16px)',
        border: '1px solid',
        borderColor: (theme) =>
          alpha(theme.palette.mode === 'light' ? theme.palette.common.white : theme.palette.common.black, 0.18),
        boxShadow: (theme) => `0 4px 24px ${alpha(theme.palette.common.black, theme.palette.mode === 'light' ? 0.06 : 0.2)}`,
        cursor: editable ? (isDragging ? 'grabbing' : 'grab') : 'default',
        transition: isDragging ? 'none' : theme.transitions.create(['transform', 'box-shadow'], {
          easing: theme.transitions.easing.easeInOut,
          duration: theme.transitions.duration.short,
        }),
        '&:hover': {
          transform: editable ? 'translateY(-4px)' : undefined,
          boxShadow: (theme) => `0 8px 30px ${alpha(theme.palette.common.black, theme.palette.mode === 'light' ? 0.1 : 0.3)}`,
          '& .hero-widget-drag-bar': { opacity: 1 },
        },
      }}
    >
      {editable && (
        <Box
          className="hero-widget-drag-bar"
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            px: 1,
            py: 0.75,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 0.5,
            opacity: 0,
            transition: theme.transitions.create('opacity'),
            zIndex: 10,
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.75),
            backdropFilter: 'blur(4px)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
            <OpenWith sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
            <Box component="span" sx={{ fontSize: 12, fontWeight: 700, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title}
            </Box>

          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            {hideOnMobile && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.25,
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 1,
                  bgcolor: (theme) => alpha(theme.palette.warning.main, 0.15),
                  color: 'warning.dark',
                }}
              >
                <PhoneAndroid sx={{ fontSize: 10 }} />
                <Box component="span" sx={{ fontSize: 10, fontWeight: 700 }}>
                  移动端隐藏
                </Box>

              </Box>

            )}
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit?.(); }} sx={{ width: 22, height: 22 }}>
              <Edit sx={{ fontSize: 12 }} />
            </IconButton>

            <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); onDelete?.(); }} sx={{ width: 22, height: 22 }}>
              <DeleteOutline sx={{ fontSize: 12 }} />
            </IconButton>

          </Box>

        </Box>

      )}
      <Box sx={{ width: '100%', height: '100%', pt: editable ? '28px' : 0, boxSizing: 'border-box' }}>
        {children}
      </Box>

    </Box>

  );
}

export function HeroBento({ hero, editable = false, onChange, onEdit, onDelete }: HeroBentoProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [liveWidgets, setLiveWidgets] = useState<HeroWidgetConfig[]>(hero.layout?.widgets || []);
  const liveWidgetsRef = useRef(liveWidgets);

  useEffect(() => {
    liveWidgetsRef.current = liveWidgets;
  }, [liveWidgets]);

  useEffect(() => {
    setLiveWidgets(hero.layout?.widgets || []);
  }, [hero.layout?.widgets]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cellSize = containerWidth > 0 ? containerWidth / FIXED_COLS : 0;

  useEffect(() => {
    if (!drag || !editable) return;
    const handleMove = (e: MouseEvent) => {
      if (!cellSize) return;
      const dxPx = e.clientX - drag.startX;
      const dyPx = e.clientY - drag.startY;
      const dx = Math.round(dxPx / cellSize);
      const dy = Math.round(dyPx / cellSize);
      const nextX = Math.max(0, Math.min(FIXED_COLS - drag.initialW, drag.initialX + dx));
      const nextY = Math.max(0, drag.initialY + dy);
      setLiveWidgets((prev) =>
        prev.map((w) => (w.id === drag.id ? { ...w, x: nextX, y: nextY } : w))
      );
      setDrag((prev) => (prev ? { ...prev, offsetX: dxPx, offsetY: dyPx } : prev));
    };
    const handleUp = () => {
      if (drag) onChange?.(liveWidgetsRef.current);
      setDrag(null);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [drag, editable, cellSize, onChange]);

  const startDrag = (e: React.MouseEvent, widget: HeroWidgetConfig) => {
    if (!editable || isMobile) return;
    e.preventDefault();
    setDrag({
      id: widget.id,
      startX: e.clientX,
      startY: e.clientY,
      initialX: widget.x,
      initialY: widget.y,
      initialW: widget.w,
      initialH: widget.h,
      offsetX: 0,
      offsetY: 0,
    });
  };

  const backgroundImage = hero.backgroundImage;
  const backgroundColor = hero.backgroundColor;

  const filledWidgets = useMemo(() => liveWidgets.map(fillHeroWidgetProps), [liveWidgets]);

  const visibleWidgets = useMemo(() => {
    if (editable || !isMobile) return filledWidgets;
    return filledWidgets.filter((w) => !w.hideOnMobile);
  }, [filledWidgets, editable, isMobile]);

  const renderWidget = (config: ReturnType<typeof fillHeroWidgetProps>) => {
    const def = getHeroWidgetDefinition(config.type);
    const opacity = Number((config.props || {}).opacity ?? 0.75);
    if (!def) {
      return (
        <WidgetGlassCard opacity={opacity} editable={editable} hideOnMobile={config.hideOnMobile} title="未知组件">
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.secondary',
              p: 2,
            }}
          >
            未知组件: {config.type}
          </Box>

        </WidgetGlassCard>

      );
    }
    return (
      <WidgetGlassCard
        opacity={opacity}
        editable={editable}
        isDragging={drag?.id === config.id}
        hideOnMobile={config.hideOnMobile}
        title={def.name}
        onMouseDown={(e) => startDrag(e, config)}
        onEdit={() => onEdit?.(config)}
        onDelete={() => onDelete?.(config)}
      >
        {def.render(config)}
      </WidgetGlassCard>

    );
  };

  const maxRow = Math.max(MIN_ROWS, ...filledWidgets.map((w) => w.y + w.h));
  const gridHeight = isMobile ? 'auto' : maxRow * cellSize + GAP;
  const emptyDesktopHeight = isMobile ? 'auto' : MIN_ROWS * cellSize + GAP;

  return (
    <HeroEditContext.Provider value={{ editable: !!editable }}>
      <Box
        ref={containerRef}
        sx={{
          position: 'relative',
          width: { xs: '100%', md: 'calc(100% - 48px)' },
          mx: { xs: 0, md: '24px' },
          my: { xs: 0, md: 2 },
          py: { xs: 3, md: 6 },
          px: { xs: 1.5, md: 3 },
          borderRadius: { xs: 0, md: 2 },
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
          backgroundColor: backgroundColor || 'background.default',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          minHeight: isMobile ? 'auto' : gridHeight,
          overflow: 'hidden',
          ...(backgroundImage && {
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              backgroundColor: (theme) => alpha(theme.palette.background.default, 0.4),
              zIndex: 0,
            },
          }),
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 1280, mx: 'auto' }}>
          {visibleWidgets.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: emptyDesktopHeight,
                minHeight: 120,
                textAlign: 'center',
                color: 'text.secondary',
                border: '2px dashed',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              暂无组件，请在后台添加积木组件
            </Box>

          ) : isMobile ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
              {visibleWidgets
                .slice()
                .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y))
                .map((config) => {
                  const area = config.w * config.h;
                  const maxHeight = Math.min(260, 100 + area * 45);
                  return (
                    <Box
                      key={config.id}
                      sx={{
                        width: '94%',
                        aspectRatio: `${config.w} / ${config.h}`,
                        maxHeight,
                      }}
                    >
                      {renderWidget(config)}
                    </Box>

                  );
                })}
            </Box>

          ) : (
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                height: gridHeight,
                userSelect: 'none',
              }}
            >
              {filledWidgets.map((config) => {
              const isDragging = drag?.id === config.id;
              const left = (config.x / FIXED_COLS) * 100;
              const top = config.y * cellSize;
              const width = (config.w / FIXED_COLS) * 100;
              const height = config.h * cellSize;
              let transform: string | undefined;
              if (isDragging && drag) {
                const snappedDx = (config.x - drag.initialX) * cellSize;
                const snappedDy = (config.y - drag.initialY) * cellSize;
                const tx = drag.offsetX - snappedDx;
                const ty = drag.offsetY - snappedDy;
                transform = `translate(${tx}px, ${ty}px)`;
              }
              return (
                <Box
                  key={config.id}
                  sx={{
                    position: 'absolute',
                    left: `${left}%`,
                    top: `${top}px`,
                    width: `calc(${width}% - ${GAP}px)`,
                    height: `${height - GAP}px`,
                    m: `${GAP / 2}px`,
                    transform,
                    transition: isDragging
                      ? 'none'
                      : theme.transitions.create(['left', 'top', 'transform'], {
                          easing: theme.transitions.easing.easeInOut,
                          duration: theme.transitions.duration.short,
                        }),
                    zIndex: isDragging ? 20 : 1,
                  }}
                >
                  {renderWidget(config)}
                </Box>

              );
            })}
          </Box>

        )}
      </Box>

      </Box>

    </HeroEditContext.Provider>

  );
}
