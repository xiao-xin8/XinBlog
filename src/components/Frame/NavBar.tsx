import {
  AppBar,
  Avatar,
  Box,
  ButtonBase,
  Collapse,
  Divider,
  IconButton,
  InputBase,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  alpha,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { LogoutConfirmDialog } from '@/components/Common/LogoutConfirmDialog';
import { Menu as MenuIcon, Person, Search, Settings, AccountCircle, Logout, ArrowBack } from '@mui/icons-material';
import { useState, useEffect, type RefObject } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ThemeToggle } from '@/components/Common/ThemeToggle';
import { NavLinks } from '@/components/Frame/NavLinks';
import { TopNavTabs } from '@/components/Frame/TopNavTabs';
import { AnimatedMenuButton } from '@/components/Frame/AnimatedMenuButton';
import { Logo } from '@/components/Common/Logo';
import { useTopNavItems } from '@/hooks/useNavItems';
import { useAuthStore } from '@/stores/authStore';
import { isContentAdmin } from '@/utils/permission';
import { useSiteStore } from '@/stores/siteStore';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { resolveSpacingConfig } from '@/utils/spacingConfig';

interface NavBarProps {
  onMenuClick: () => void;
  drawerOpen?: boolean;
  drawerWidth?: number;
  scrollTargetRef?: RefObject<HTMLElement | null>;
  /** 顶部栏布局：导航以胶囊 Tab 形式内联在顶栏中；移动端用汉堡按钮 */
  layout?: 'sidebar' | 'top';
  /** 全屏英雄区处于顶部时：导航整体透明悬浮（滚动离开首屏后自动恢复） */
  transparent?: boolean;
}

export function NavBar({
  onMenuClick,
  drawerOpen = false,
  drawerWidth = 0,
  scrollTargetRef,
  layout = 'sidebar',
  transparent = false,
}: NavBarProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTop = layout === 'top';
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuthStore();
  const { config } = useSiteStore();
  const spacing = resolveSpacingConfig(config.spacing);
  const navTheme = config.nav?.theme || { variant: 'default' };
  const isGlass = navTheme.variant === 'glass';
  const hideOnScroll = navTheme.hideOnScroll ?? true;
  const { hidden, scrollY } = useScrollDirection(hideOnScroll ? 64 : 0, scrollTargetRef);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [searchValue, setSearchValue] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const userMenuOpen = Boolean(anchorEl);
  const location = useLocation();
  const topNavItems = useTopNavItems();

  // 顶部栏布局下，移动端下拉导航在切换路由后自动收起
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchValue.trim();
    if (trimmed) {
      navigate(`/?q=${encodeURIComponent(trimmed)}`);
    }
  };

  const handleMobileSearchOpen = () => {
    setMobileSearchOpen(true);
  };

  const handleMobileSearchClose = () => {
    setMobileSearchOpen(false);
    setSearchValue('');
  };

  // 全屏英雄区：仅在首屏顶部时透明悬浮；一旦向下滚动离开首屏即恢复常规外观
  const isHeroFullscreen = transparent && scrollY <= 8;
  // 透明悬浮时导航文字需在背景图上可读，统一用白色
  const overlayText = isHeroFullscreen;

  const glassOpacity = navTheme.glassOpacity ?? 0.4;
  const glassBlur = navTheme.blur ?? 16;
  const borderOpacity = navTheme.borderOpacity ?? 0.2;
  const shadowOpacity = navTheme.shadowOpacity ?? 0.08;

  return (
    <AppBar
      position="fixed"
      color="inherit"
      elevation={0}
      sx={{
        backdropFilter: isHeroFullscreen ? 'none' : isGlass ? `blur(${glassBlur}px)` : 'blur(12px)',
        backgroundColor: isHeroFullscreen
          ? 'transparent'
          : isGlass
            ? (theme) => alpha(theme.palette.background.paper, glassOpacity)
            : (theme) => alpha(theme.palette.background.paper, theme.palette.mode === 'light' ? 0.85 : 0.8),
        color: overlayText ? '#fff' : 'inherit',
        borderBottom: isHeroFullscreen ? 0 : isGlass ? 1 : 0,
        borderColor: isGlass
          ? (theme) =>
              alpha(
                theme.palette.mode === 'light' ? theme.palette.common.white : theme.palette.common.black,
                borderOpacity
              )
          : 'transparent',
        boxShadow: isHeroFullscreen
          ? 'none'
          : isGlass
            ? (theme) =>
                `0 4px 24px ${alpha(theme.palette.common.black, shadowOpacity)}`
            : 'none',
        // 透明悬浮时给文字加轻微阴影，避免压在浅色图片上看不清
        textShadow: isHeroFullscreen ? '0 1px 8px rgba(0,0,0,0.45)' : 'none',
        transition: theme.transitions.create(['width', 'margin-left', 'transform', 'background-color', 'border-color', 'box-shadow'], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
        width: !isMobile && drawerOpen && drawerWidth > 0 ? `calc(100% - ${drawerWidth}px)` : '100%',
        marginLeft: !isMobile && drawerOpen && drawerWidth > 0 ? `${drawerWidth}px` : 0,
        transform: hidden ? 'translateY(-100%)' : 'translateY(0)',
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', px: { xs: `${spacing.navPaddingX.mobile}px`, md: `${spacing.navPaddingX.desktop}px` }, minHeight: { xs: 56, sm: 64 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          {isTop ? (
            <>
              {/* 顶部栏布局：桌面端显示站点图标与名称（侧边栏布局下由侧边栏承担，此处不显示） */}
              <Box sx={{ display: { xs: 'none', md: 'flex' }, flexShrink: 0 }}>
                <Logo />
              </Box>
              {/* 顶部栏布局：移动端用汉堡按钮展开顶部下拉导航 */}
              <Box sx={{ display: { md: 'none' } }}>
                <AnimatedMenuButton
                  open={mobileNavOpen}
                  onClick={() => setMobileNavOpen((v) => !v)}
                  color={navTheme.textColor || theme.palette.text.primary}
                />
              </Box>
            </>
          ) : (
            <IconButton
              onClick={onMenuClick}
              aria-label="打开导航菜单"
              className="live2d-tip-menu"
              sx={{
                display: { md: 'none' },
                color: navTheme.textColor || 'text.primary',
                borderRadius: 1,
              }}
            >
              <MenuIcon />
            </IconButton>
          )}
        </Box>

        {isMobile ? (
          <Box
            component="form"
            onSubmit={handleSearchSubmit}
            sx={{
              display: { xs: 'none', sm: 'flex' },
              alignItems: 'center',
              flex: 'none',
              width: { sm: 200, md: 240 },
              mx: { sm: 1.5, md: 2 },
              px: 2,
              py: 0.75,
              borderRadius: isGlass ? 6 : 1,
              backgroundColor: isGlass
                ? (theme) => alpha(theme.palette.common.white, theme.palette.mode === 'light' ? 0.15 : 0.08)
                : (theme) =>
                    theme.palette.mode === 'light'
                      ? alpha(theme.palette.primary.main, 0.06)
                      : alpha(theme.palette.common.white, 0.06),
              border: isGlass ? 1 : 0,
              borderColor: isGlass
                ? (theme) => alpha(theme.palette.common.white, theme.palette.mode === 'light' ? 0.3 : 0.1)
                : 'transparent',
              transition: theme.transitions.create(['background-color', 'box-shadow', 'border-color'], {
                easing: theme.transitions.easing.easeInOut,
                duration: theme.transitions.duration.short,
              }),
              '&:hover': {
                backgroundColor: isGlass
                  ? (theme) => alpha(theme.palette.common.white, theme.palette.mode === 'light' ? 0.22 : 0.12)
                  : (theme) =>
                      theme.palette.mode === 'light'
                        ? alpha(theme.palette.primary.main, 0.1)
                        : alpha(theme.palette.common.white, 0.1),
              },
              '&:focus-within': {
                backgroundColor: isGlass
                  ? (theme) => alpha(theme.palette.common.white, theme.palette.mode === 'light' ? 0.28 : 0.16)
                  : (theme) =>
                      theme.palette.mode === 'light'
                        ? alpha(theme.palette.primary.main, 0.14)
                        : alpha(theme.palette.common.white, 0.14),
                boxShadow: (theme) => `0 0 0 2px ${alpha(navTheme.activeColor || theme.palette.primary.main, 0.25)}`,
                borderColor: (theme) => alpha(navTheme.activeColor || theme.palette.primary.main, 0.4),
              },
            }}
          >
            <Search sx={{ color: navTheme.textColor ? alpha(navTheme.textColor, 0.7) : 'text.secondary', mr: 1, fontSize: 20 }} />
            <InputBase
              placeholder="搜索文章..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              inputProps={{ 'aria-label': '搜索文章' }}
              sx={{
                flex: 1,
                typography: 'body2',
                color: navTheme.textColor || 'inherit',
                '& input::placeholder': {
                  color: navTheme.textColor ? alpha(navTheme.textColor, 0.6) : 'text.secondary',
                  opacity: 0.7,
                },
              }}
            />
          </Box>
        ) : (
          <Box
            sx={{
              flex: 'none',
              width: { md: 240, lg: 280 },
              mx: { md: 2, lg: 3 },
              visibility: 'hidden',
            }}
          />
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: { xs: `${spacing.navGap.mobile}px`, md: `${spacing.navGap.desktop}px` }, flex: 1, minWidth: 0 }}>
          {isTop ? (
            /* 顶部栏布局：导航区绝对居中，无视左右两侧元素，始终以整条顶栏为基准居中 */
            <Box
              sx={{
                position: 'absolute',
                left: '50%',
                top: 0,
                bottom: 0,
                width: { md: '68%', lg: '74%' },
                transform: 'translateX(-50%)',
                display: { xs: 'none', md: 'flex' },
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 0,
                pointerEvents: 'none',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  minWidth: 0,
                  pointerEvents: 'auto',
                }}
              >
                <TopNavTabs navTheme={navTheme} />
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: { xs: 'none', md: 'flex' }, flex: 1, minWidth: 0, maxWidth: { md: '82%', lg: '88%' } }}>
              <NavLinks items={config.nav?.items || []} navTheme={navTheme} />
            </Box>
          )}
          {/* 顶部栏布局的移动端导航走汉堡抽屉，不再重复渲染下拉菜单 */}
          {!isTop && (
            <Box sx={{ display: { md: 'none' } }}>
              <NavLinks items={config.nav?.items || []} forceMobile navTheme={navTheme} />
            </Box>
          )}
          <Tooltip title="搜索文章">
            <IconButton
              onClick={handleMobileSearchOpen}
              aria-label="搜索文章"
              className="live2d-tip-search"
              sx={{
                display: { sm: 'none' },
                color: navTheme.textColor || 'text.secondary',
                borderRadius: 1,
                width: { xs: 44, sm: 36 },
                height: { xs: 44, sm: 36 },
              }}
            >
              <Search />
            </IconButton>
          </Tooltip>
          <Box sx={{ color: navTheme.textColor || 'inherit' }}>
            <ThemeToggle />
          </Box>

          {isAuthenticated && user ? (
            <>
              <Tooltip title="账户菜单">
                <IconButton
                  onClick={handleUserMenuOpen}
                  size="small"
                  aria-label="账户菜单"
                  className="live2d-tip-user"
                  aria-controls={userMenuOpen ? 'user-menu' : undefined}
                  aria-haspopup="true"
                  aria-expanded={userMenuOpen ? 'true' : undefined}
                  sx={{
                    ml: 0.5,
                    width: { xs: 44, sm: 36 },
                    height: { xs: 44, sm: 36 },
                    color: navTheme.textColor || 'text.secondary',
                  }}
                >
                  <Avatar
                    src={user.avatar || undefined}
                    sx={{
                      width: { xs: 36, sm: 32 },
                      height: { xs: 36, sm: 32 },
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    {user.username.charAt(0).toUpperCase()}
                  </Avatar>
                </IconButton>
              </Tooltip>
              <Menu
                id="user-menu"
                anchorEl={anchorEl}
                open={userMenuOpen}
                onClose={handleUserMenuClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                PaperProps={{
                  sx: {
                    mt: 1,
                    borderRadius: 1,
                    minWidth: 180,
                    boxShadow: (theme) =>
                      theme.palette.mode === 'light'
                        ? `0 8px 32px ${alpha(theme.palette.primary.main, 0.12)}`
                        : `0 8px 32px ${alpha(theme.palette.common.black, 0.4)}`,
                  },
                }}
              >
                <MenuItem
                  component={Link}
                  to="/profile"
                  onClick={handleUserMenuClose}
                >
                  <AccountCircle fontSize="small" sx={{ mr: 1.5 }} />
                  个人中心
                </MenuItem>
                {isContentAdmin(user?.role) && (
                  <MenuItem
                    component={Link}
                    to="/admin"
                    onClick={handleUserMenuClose}
                  >
                    <Settings fontSize="small" sx={{ mr: 1.5 }} />
                    管理后台
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() => {
                    handleUserMenuClose();
                    setLogoutOpen(true);
                  }}
                >
                  <Logout fontSize="small" sx={{ mr: 1.5 }} />
                  退出登录
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Tooltip title="登录">
              <IconButton
                component={Link}
                to="/admin/login"
                aria-label="登录"
                className="live2d-tip-login"
                sx={{
                  color: navTheme.textColor || 'text.secondary',
                  borderRadius: 1,
                  width: { xs: 44, sm: 36 },
                  height: { xs: 44, sm: 36 },
                }}
              >
                <Person />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Toolbar>

      {/* 顶部栏布局：移动端从顶部落下的导航菜单（一条条列表，非胶囊） */}
      {isTop && (
        <Box
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            display: { md: 'none' },
            maxHeight: 'calc(100dvh - 64px)',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            pointerEvents: mobileNavOpen ? 'auto' : 'none',
          }}
        >
          <Collapse in={mobileNavOpen} timeout={280}>
            <Box
              sx={{
                backdropFilter: isGlass ? `blur(${glassBlur}px)` : 'blur(12px)',
                backgroundColor: isGlass
                  ? (theme) => alpha(theme.palette.background.paper, glassOpacity)
                  : (theme) =>
                      alpha(theme.palette.background.paper, theme.palette.mode === 'light' ? 0.97 : 0.95),
                borderBottom: isGlass ? 1 : 0,
                borderColor: isGlass
                  ? (theme) =>
                      alpha(
                        theme.palette.mode === 'light' ? theme.palette.common.white : theme.palette.common.black,
                        borderOpacity
                      )
                  : 'transparent',
                boxShadow: isGlass
                  ? (theme) => `0 8px 28px ${alpha(theme.palette.common.black, shadowOpacity)}`
                  : 'none',
              }}
            >
              {topNavItems.map((item, index) => {
                const active =
                  !/^https?:\/\//i.test(item.url) &&
                  (item.url === '/' ? location.pathname === '/' : location.pathname.startsWith(item.url));
                const rowSx = {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  width: '100%',
                  px: { xs: `${spacing.navPaddingX.mobile}px`, sm: 3 },
                  py: 1.5,
                  justifyContent: 'flex-start',
                  textAlign: 'left' as const,
                  color: item.color?.trim()
                    ? item.color
                    : active
                      ? navTheme.activeColor || 'primary.main'
                      : navTheme.textColor || 'text.primary',
                  fontWeight: active ? 700 : 500,
                  backgroundColor: active
                    ? (theme: Theme) => alpha(theme.palette.primary.main, 0.08)
                    : 'transparent',
                  '&:hover': {
                    backgroundColor: (theme: Theme) => theme.palette.action.hover,
                  },
                };
                const isExternal = /^https?:\/\//i.test(item.url);
                return (
                  <Box key={item.id}>
                    {index > 0 && <Divider />}
                    {isExternal ? (
                      <ButtonBase
                        component="a"
                        href={item.url}
                        target={item.openInNewTab ? '_blank' : undefined}
                        rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                        onClick={() => setMobileNavOpen(false)}
                        sx={rowSx}
                      >
                        {item.icon}
                        {item.title}
                      </ButtonBase>
                    ) : (
                      <ButtonBase component={Link} to={item.url} onClick={() => setMobileNavOpen(false)} sx={rowSx}>
                        {item.icon}
                        {item.title}
                      </ButtonBase>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Collapse>
        </Box>
      )}

      {mobileSearchOpen && (
        <Toolbar
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            px: { xs: 1.5, sm: 3 },
            gap: 1,
            backdropFilter: isGlass ? `blur(${glassBlur}px)` : 'blur(12px)',
            backgroundColor: isGlass
              ? (theme) => alpha(theme.palette.background.paper, glassOpacity)
              : (theme) => alpha(theme.palette.background.paper, theme.palette.mode === 'light' ? 0.95 : 0.92),
            borderBottom: isGlass ? 1 : 0,
            borderColor: isGlass
              ? (theme) =>
                  alpha(
                    theme.palette.mode === 'light' ? theme.palette.common.white : theme.palette.common.black,
                    borderOpacity
                  )
              : 'transparent',
            boxShadow: isGlass
              ? (theme) => `0 4px 24px ${alpha(theme.palette.common.black, shadowOpacity)}`
              : 'none',
          }}
        >
          <IconButton
            onClick={handleMobileSearchClose}
            aria-label="关闭搜索"
            sx={{ color: navTheme.textColor || 'text.primary', width: 44, height: 44, flexShrink: 0 }}
          >
            <ArrowBack />
          </IconButton>
          <Box
            component="form"
            onSubmit={handleSearchSubmit}
            sx={{
              display: 'flex',
              alignItems: 'center',
              flex: 1,
              px: 1.5,
              py: 0.5,
              borderRadius: isGlass ? 6 : 1,
              backgroundColor: isGlass
                ? (theme) =>
                    alpha(
                      theme.palette.mode === 'light' ? theme.palette.common.white : theme.palette.common.black,
                      theme.palette.mode === 'light' ? 0.15 : 0.1
                    )
                : (theme) =>
                    theme.palette.mode === 'light'
                      ? alpha(theme.palette.primary.main, 0.06)
                      : alpha(theme.palette.common.white, 0.06),
              border: isGlass ? 1 : 0,
              borderColor: isGlass
                ? (theme) =>
                    alpha(
                      theme.palette.mode === 'light' ? theme.palette.common.white : theme.palette.common.black,
                      borderOpacity
                    )
                : 'transparent',
            }}
          >
            <Search sx={{ color: navTheme.textColor ? alpha(navTheme.textColor, 0.7) : 'text.secondary', mr: 1, fontSize: 20, flexShrink: 0 }} />
            <InputBase
              autoFocus
              placeholder="搜索文章..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              inputProps={{ 'aria-label': '搜索文章' }}
              sx={{
                flex: 1,
                typography: 'body2',
                color: navTheme.textColor || 'text.primary',
                '& input::placeholder': {
                  color: navTheme.textColor ? alpha(navTheme.textColor, 0.7) : 'text.secondary',
                  opacity: 0.7,
                },
              }}
            />
          </Box>
        </Toolbar>
      )}

      <LogoutConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          logout();
        }}
      />
    </AppBar>
  );
}
