import { useState } from 'react';
import { Box, ButtonBase, IconButton, Menu, MenuItem, Tooltip, alpha, useTheme, useMediaQuery } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { Link, useLocation } from 'react-router-dom';
import { MenuOpen } from '@mui/icons-material';
import { useSiteStore } from '@/stores/siteStore';
import type { NavItemConfig, NavThemeConfig } from '@/types';
function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}
function resolveNavColor(color?: string): string | undefined {
  if (!color) return undefined;
  const trimmed = color.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed;
  return trimmed;
}
interface DesktopNavLinkProps {
  item: NavItemConfig;
  active: boolean;
  navTheme?: NavThemeConfig;
}
function DesktopNavLink({ item, active, navTheme }: DesktopNavLinkProps) {
  const theme = useTheme();
  const customColor = resolveNavColor(item.color);
  const textColor = customColor || navTheme?.textColor;
  const activeColor = customColor || navTheme?.activeColor || theme.palette.primary.main;
  const isGlass = navTheme?.variant === 'glass';
  const color = textColor
    ? active
      ? textColor
      : alpha(textColor, theme.palette.mode === 'light' ? 0.85 : 0.75)
    : active
      ? activeColor
      : 'text.primary';
  const baseSx = {
    position: 'relative' as const,
    px: isGlass ? 2 : 1.5,
    py: isGlass ? 1 : 0.75,
    borderRadius: 1.5,
    typography: isGlass ? 'body1' : 'body2',
    fontWeight: active ? 700 : 600,
    color,
    textTransform: 'none' as const,
    whiteSpace: 'nowrap',
    minWidth: 'max-content',
    cursor: 'pointer',
    backgroundColor: 'transparent',
    transition: theme.transitions.create(['color'], {
      easing: theme.transitions.easing.easeInOut,
      duration: theme.transitions.duration.short,
    }),
    '&:hover': {
      backgroundColor: 'transparent',
      color: textColor || activeColor,
    },
    '&:active': {
      backgroundColor: 'transparent',
    },
    '&:focus-visible': {
      backgroundColor: 'transparent',
      outline: `2px solid ${alpha(activeColor, 0.5)}`,
      outlineOffset: 2,
    },
    '&::after': active
      ? {
          content: '""',
          position: 'absolute',
          bottom: 4,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 4,
          height: 4,
          borderRadius: '50%',
          backgroundColor: activeColor,
        }
      : {},
  };
  if (isExternalUrl(item.url)) {
    return (
      <ButtonBase
        component="a"
        href={item.url}
        target={item.openInNewTab ? '_blank' : undefined}
        rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
        sx={baseSx}
      >
        {item.title}
      </ButtonBase>
    );
  }
  return (
    <ButtonBase component={Link} to={item.url} sx={baseSx}>
      {item.title}
    </ButtonBase>
  );
}
interface MobileNavMenuProps {
  items: NavItemConfig[];
  navTheme?: NavThemeConfig;
}
const defaultNavItems: NavItemConfig[] = [
  { id: 'nav-home', title: '首页', url: '/', color: '', openInNewTab: false },
  { id: 'nav-tags', title: '标签', url: '/tag/all', color: '', openInNewTab: false },
  { id: 'nav-friends', title: '友链', url: '/friends', color: '', openInNewTab: false },
  { id: 'nav-about', title: '关于', url: '/about', color: '', openInNewTab: false },
  { id: 'nav-profile', title: '个人中心', url: '/profile', color: '', openInNewTab: false },
];
function MobileNavMenu({ items, navTheme }: MobileNavMenuProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const location = useLocation();
  const open = Boolean(anchorEl);
  const displayItems = items.length > 0 ? items : defaultNavItems;
  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);
  return (
    <>
      <Tooltip title="导航菜单">
        <IconButton
          onClick={handleOpen}
          aria-label="导航菜单"
          aria-controls={open ? 'nav-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          sx={{
            color: navTheme?.textColor || 'text.primary',
            borderRadius: 1.5,
            width: { xs: 44, sm: 36 },
            height: { xs: 44, sm: 36 },
            bgcolor: (theme) =>
              open ? alpha(navTheme?.activeColor || theme.palette.primary.main, 0.12) : 'transparent',
          }}
        >
          <MenuOpen />
        </IconButton>
      </Tooltip>
      <Menu
        id="nav-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              borderRadius: 2,
              minWidth: 180,
              bgcolor: (theme) => alpha(theme.palette.background.paper, navTheme?.variant === 'glass' ? 0.85 : 1),
              backdropFilter: navTheme?.variant === 'glass' ? 'blur(16px)' : 'none',
              border: (theme) =>
                navTheme?.variant === 'glass'
                  ? `1px solid ${alpha(theme.palette.common.white, theme.palette.mode === 'light' ? 0.3 : 0.1)}`
                  : 'none',
              boxShadow: (theme) =>
                theme.palette.mode === 'light'
                  ? `0 8px 32px ${alpha(theme.palette.primary.main, 0.12)}`
                  : `0 8px 32px ${alpha(theme.palette.common.black, 0.4)}`,
            },
          },
        }}
      >
        {displayItems.map((item) => {
          const active = item.url === '/' ? location.pathname === '/' : location.pathname.startsWith(item.url);
          const customColor = resolveNavColor(item.color);
          const textColor = customColor || navTheme?.textColor;
          const activeColor = customColor || navTheme?.activeColor;
          const color = textColor || (active ? activeColor || 'primary.main' : 'text.primary');
          const menuItemSx = {
            color,
            fontWeight: active ? 700 : 500,
            borderRadius: 1,
            mx: 0.5,
            my: 0.25,
            '&:hover': {
              bgcolor: (theme: Theme) => alpha(navTheme?.activeColor || theme.palette.primary.main, 0.08),
            },
          };
          if (isExternalUrl(item.url)) {
            return (
              <MenuItem
                key={item.id}
                component="a"
                href={item.url}
                target={item.openInNewTab ? '_blank' : undefined}
                rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                onClick={handleClose}
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
              onClick={handleClose}
              sx={menuItemSx}
            >
              {item.title}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
interface NavLinksProps {
  items: NavItemConfig[];
  forceMobile?: boolean;
  navTheme?: NavThemeConfig;
}
export function NavLinks({ items, forceMobile, navTheme }: NavLinksProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { config } = useSiteStore();
  const fallbackItems = config.friends?.enabled
    ? defaultNavItems
    : defaultNavItems.filter((item) => item.url !== '/friends');
  const displayItems = items.length > 0 ? items : fallbackItems;
  const isLg = useMediaQuery(theme.breakpoints.up('lg'));
  if (forceMobile || isMobile) {
    return <MobileNavMenu items={displayItems} navTheme={navTheme} />;
  }
  const maxVisible = isLg ? 5 : 3;
  const visibleItems = displayItems.slice(0, maxVisible);
  const moreItems = displayItems.slice(maxVisible);
  return (
    <DesktopNavLinks
      visibleItems={visibleItems}
      moreItems={moreItems}
      navTheme={navTheme}
    />
  );
}
interface DesktopNavLinksProps {
  visibleItems: NavItemConfig[];
  moreItems: NavItemConfig[];
  navTheme?: NavThemeConfig;
}
function DesktopNavLinks({ visibleItems, moreItems, navTheme }: DesktopNavLinksProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const location = useLocation();
  const theme = useTheme();
  const textColor = navTheme?.textColor;
  const activeColor = navTheme?.activeColor || theme.palette.primary.main;
  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        pl: 2,
        mr: 'auto',
        overflowX: 'auto',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      {visibleItems.map((item) => {
        const active = item.url === '/' ? location.pathname === '/' : location.pathname.startsWith(item.url);
        return <DesktopNavLink key={item.id} item={item} active={active} navTheme={navTheme} />;
      })}
      {moreItems.length > 0 && (
        <>
          <ButtonBase
            onClick={handleOpen}
            aria-label="更多导航"
            aria-controls={open ? 'nav-more-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={open ? 'true' : undefined}
            sx={{
              position: 'relative',
              px: 1.5,
              py: 0.75,
              borderRadius: 1.5,
              typography: 'body2',
              fontWeight: 600,
              color: textColor || 'text.primary',
              textTransform: 'none' as const,
              whiteSpace: 'nowrap',
              minWidth: 'max-content',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              '&:hover': { backgroundColor: 'transparent', color: textColor || activeColor },
              '&:active': { backgroundColor: 'transparent' },
              '&:focus-visible': {
                backgroundColor: 'transparent',
                outline: `2px solid ${alpha(activeColor, 0.5)}`,
                outlineOffset: 2,
              },
            }}
          >
            更多
          </ButtonBase>
          <Menu
            id="nav-more-menu"
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            slotProps={{
              paper: {
                sx: {
                  mt: 1,
                  borderRadius: 2,
                  minWidth: 180,
                  bgcolor: (theme) => alpha(theme.palette.background.paper, navTheme?.variant === 'glass' ? 0.85 : 1),
                  backdropFilter: navTheme?.variant === 'glass' ? 'blur(16px)' : 'none',
                },
              },
            }}
          >
            {moreItems.map((item) => {
              const active = item.url === '/' ? location.pathname === '/' : location.pathname.startsWith(item.url);
              const customColor = resolveNavColor(item.color);
              const itemTextColor = customColor || textColor;
              const itemActiveColor = customColor || activeColor;
              const color = itemTextColor || (active ? itemActiveColor : 'text.primary');
              const menuItemSx = {
                color,
                fontWeight: active ? 700 : 500,
                borderRadius: 1,
                mx: 0.5,
                my: 0.25,
                '&:hover': {
                  bgcolor: (theme: Theme) => alpha(navTheme?.activeColor || theme.palette.primary.main, 0.08),
                },
              };
              if (isExternalUrl(item.url)) {
                return (
                  <MenuItem
                    key={item.id}
                    component="a"
                    href={item.url}
                    target={item.openInNewTab ? '_blank' : undefined}
                    rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                    onClick={handleClose}
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
                  onClick={handleClose}
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