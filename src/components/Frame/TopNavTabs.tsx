import { useEffect, useRef, useState } from 'react';
import {
  Box,
  ButtonBase,
  Menu,
  MenuItem,
  Tab,
  Tabs,
  alpha,
  useTheme,
} from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import { KeyboardArrowDown } from '@mui/icons-material';
import { useTopNavItems, type TopNavItem } from '@/hooks/useNavItems';
import type { NavThemeConfig } from '@/types';

function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function isNavActive(url: string, pathname: string): boolean {
  if (isExternalUrl(url)) return false;
  if (url === '/') return pathname === '/';
  return pathname.startsWith(url);
}

function resolveNavColor(color?: string): string | undefined {
  const trimmed = color?.trim();
  return trimmed ? trimmed : undefined;
}

interface TopNavTabsProps {
  navTheme?: NavThemeConfig;
}

/**
 * 顶部栏导航：液态玻璃胶囊容器 + 滑动指示器。
 * 数据源 = 侧边栏内置项 + 后台添加的自定义导航项（见 useTopNavItems）。
 */
export function TopNavTabs({ navTheme }: TopNavTabsProps) {
  const theme = useTheme();
  const location = useLocation();
  const items = useTopNavItems();
  const [moreAnchor, setMoreAnchor] = useState<null | HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxVisible, setMaxVisible] = useState(items.length);

  // 依据容器实际可用宽度决定能放下多少个导航项，放不下的收进「更多」菜单。
  // 相比固定数量上限，这里能充分利用桌面端的横向空间。
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const AVG_TAB_WIDTH = 78; // 单个胶囊的平均宽度（含内边距与间距）
    const MORE_BUTTON_WIDTH = 96; // 「更多」按钮及其间距占位
    const update = () => {
      const width = el.clientWidth;
      if (!width) return;
      const total = items.length;
      if (Math.floor(width / AVG_TAB_WIDTH) >= total) {
        setMaxVisible(total);
        return;
      }
      const fit = Math.floor((width - MORE_BUTTON_WIDTH) / AVG_TAB_WIDTH);
      setMaxVisible(Math.max(1, fit));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [items.length]);

  const visibleItems = items.slice(0, maxVisible);
  const moreItems = items.slice(maxVisible);

  const glassOpacity = navTheme?.glassOpacity ?? 0.4;
  const glassBlur = navTheme?.blur ?? 16;
  const borderOpacity = navTheme?.borderOpacity ?? 0.2;
  const shadowOpacity = navTheme?.shadowOpacity ?? 0.08;
  const textColor = navTheme?.textColor;
  const activeColor = navTheme?.activeColor || theme.palette.primary.main;

  const activeIndex = visibleItems.findIndex((item) => isNavActive(item.url, location.pathname));

  const tabSx = (item: TopNavItem, active: boolean) => {
    const customColor = resolveNavColor(item.color);
    const itemText = customColor || textColor;
    const itemActive = customColor || activeColor;
    return {
      position: 'relative' as const,
      zIndex: 1,
      minWidth: 0,
      minHeight: 0,
      px: 2,
      py: 0.75,
      borderRadius: '999px',
      textTransform: 'none' as const,
      typography: 'body2',
      fontWeight: active ? 700 : 600,
      whiteSpace: 'nowrap' as const,
      color: itemText
        ? active
          ? itemText
          : alpha(itemText, theme.palette.mode === 'light' ? 0.85 : 0.75)
        : active
          ? itemActive
          : 'text.primary',
      transition: theme.transitions.create(['color'], {
        easing: theme.transitions.easing.easeInOut,
        duration: theme.transitions.duration.short,
      }),
      '&:hover': { color: itemText || itemActive },
    };
  };

  if (items.length === 0) return null;

  return (
    <Box
      ref={containerRef}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        width: '100%',
        minWidth: 0,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 0.5,
          borderRadius: '999px',
          backgroundColor: (t) => alpha(t.palette.background.paper, glassOpacity),
          backdropFilter: `blur(${glassBlur}px)`,
          WebkitBackdropFilter: `blur(${glassBlur}px)`,
          border: 1,
          borderColor: (t) =>
            alpha(t.palette.mode === 'light' ? t.palette.common.white : t.palette.common.black, borderOpacity),
          boxShadow: (t) => `0 4px 24px ${alpha(t.palette.common.black, shadowOpacity)}`,
          minWidth: 0,
        }}
      >
        <Tabs
          value={activeIndex === -1 ? false : activeIndex}
          variant="standard"
          sx={{
            minHeight: 0,
            '& .MuiTabs-flexContainer': { gap: 0.5 },
            // 滑动指示器：铺满单个胶囊，随选中项平滑移动
            '& .MuiTabs-indicator': {
              zIndex: 0,
              height: '100%',
              bottom: 0,
              borderRadius: '999px',
              backgroundColor: alpha(activeColor, theme.palette.mode === 'light' ? 0.14 : 0.24),
            },
          }}
        >
          {visibleItems.map((item, index) => {
            const active = index === activeIndex;
            const sx = tabSx(item, active);
            if (isExternalUrl(item.url)) {
              return (
                <Tab
                  key={item.id}
                  component="a"
                  href={item.url}
                  target={item.openInNewTab ? '_blank' : undefined}
                  rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                  label={item.title}
                  sx={sx}
                />
              );
            }
            return (
              <Tab key={item.id} component={Link} to={item.url} label={item.title} sx={sx} />
            );
          })}
        </Tabs>
      </Box>

      {moreItems.length > 0 && (
        <>
          <ButtonBase
            onClick={(e) => setMoreAnchor(e.currentTarget)}
            aria-label="更多导航"
            aria-haspopup="true"
            aria-expanded={Boolean(moreAnchor)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.25,
              px: 1.5,
              py: 1,
              borderRadius: '999px',
              typography: 'body2',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              color: textColor || 'text.primary',
              backgroundColor: (t) => alpha(t.palette.background.paper, glassOpacity),
              backdropFilter: `blur(${glassBlur}px)`,
              WebkitBackdropFilter: `blur(${glassBlur}px)`,
              border: 1,
              borderColor: (t) =>
                alpha(t.palette.mode === 'light' ? t.palette.common.white : t.palette.common.black, borderOpacity),
            }}
          >
            更多
            <KeyboardArrowDown sx={{ fontSize: 18 }} />
          </ButtonBase>
          <Menu
            anchorEl={moreAnchor}
            open={Boolean(moreAnchor)}
            onClose={() => setMoreAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{
              paper: {
                sx: {
                  mt: 1,
                  borderRadius: 2,
                  minWidth: 180,
                  bgcolor: (t) => alpha(t.palette.background.paper, glassOpacity),
                  backdropFilter: `blur(${glassBlur}px)`,
                  border: 1,
                  borderColor: (t) =>
                    alpha(
                      t.palette.mode === 'light' ? t.palette.common.white : t.palette.common.black,
                      borderOpacity
                    ),
                  boxShadow: (t) => `0 8px 32px ${alpha(t.palette.common.black, shadowOpacity + 0.12)}`,
                },
              },
            }}
          >
            {moreItems.map((item) => {
              const active = isNavActive(item.url, location.pathname);
              const customColor = resolveNavColor(item.color);
              const itemColor = customColor || textColor;
              const itemActiveColor = customColor || activeColor;
              const menuItemSx = {
                color: itemColor || (active ? itemActiveColor : 'text.primary'),
                fontWeight: active ? 700 : 500,
                borderRadius: 1,
                mx: 0.5,
                my: 0.25,
                '&:hover': { bgcolor: alpha(activeColor, 0.08) },
              };
              if (isExternalUrl(item.url)) {
                return (
                  <MenuItem
                    key={item.id}
                    component="a"
                    href={item.url}
                    target={item.openInNewTab ? '_blank' : undefined}
                    rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                    onClick={() => setMoreAnchor(null)}
                    sx={menuItemSx}
                  >
                    {item.title}
                  </MenuItem>
                );
              }
              return (
                <MenuItem
                  key={item.id}
                  component={Link}
                  to={item.url}
                  onClick={() => setMoreAnchor(null)}
                  sx={menuItemSx}
                >
                  {item.title}
                </MenuItem>
              );
            })}
          </Menu>
        </>
      )}
    </Box>
  );
}
