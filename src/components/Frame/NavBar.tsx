import {
  AppBar,
  Avatar,
  Box,
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
import { LogoutConfirmDialog } from '@/components/Common/LogoutConfirmDialog';
import { Menu as MenuIcon, Person, Search, Settings, AccountCircle, Logout, ArrowBack } from '@mui/icons-material';
import { useState, type RefObject } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ThemeToggle } from '@/components/Common/ThemeToggle';
import { NavLinks } from '@/components/Frame/NavLinks';
import { NavLogo } from '@/components/Frame/NavLogo';
import { useAuthStore } from '@/stores/authStore';
import { useSiteStore } from '@/stores/siteStore';
import { useScrollDirection } from '@/hooks/useScrollDirection';

interface NavBarProps {
  onMenuClick: () => void;
  drawerOpen?: boolean;
  drawerWidth?: number;
  scrollTargetRef?: RefObject<HTMLElement | null>;
}

export function NavBar({ onMenuClick, drawerOpen = false, drawerWidth = 0, scrollTargetRef }: NavBarProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuthStore();
  const { config } = useSiteStore();
  const navTheme = config.nav?.theme || { variant: 'default' };
  const isGlass = navTheme.variant === 'glass';
  const hideOnScroll = navTheme.hideOnScroll ?? true;
  const { hidden } = useScrollDirection(hideOnScroll ? 64 : 0, scrollTargetRef);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [searchValue, setSearchValue] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const userMenuOpen = Boolean(anchorEl);

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
        backdropFilter: isGlass ? `blur(${glassBlur}px)` : 'blur(12px)',
        backgroundColor: isGlass
          ? (theme) => alpha(theme.palette.background.paper, glassOpacity)
          : (theme) => alpha(theme.palette.background.paper, theme.palette.mode === 'light' ? 0.85 : 0.8),
        borderBottom: isGlass ? 1 : 0,
        borderColor: isGlass
          ? (theme) =>
              alpha(
                theme.palette.mode === 'light' ? theme.palette.common.white : theme.palette.common.black,
                borderOpacity
              )
          : 'transparent',
        boxShadow: isGlass
          ? (theme) =>
              `0 4px 24px ${alpha(theme.palette.common.black, shadowOpacity)}`
          : 'none',
        transition: theme.transitions.create(['width', 'margin-left', 'transform', 'background-color', 'border-color', 'box-shadow'], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
        width: !isMobile && drawerOpen && drawerWidth > 0 ? `calc(100% - ${drawerWidth}px)` : '100%',
        marginLeft: !isMobile && drawerOpen && drawerWidth > 0 ? `${drawerWidth}px` : 0,
        transform: hidden ? 'translateY(-100%)' : 'translateY(0)',
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, sm: 3 }, minHeight: { xs: 56, sm: 64 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <IconButton
            edge="start"
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
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', minWidth: 0 }}>
            <NavLogo navTheme={navTheme} />
          </Box>
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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, flex: 1, minWidth: 0 }}>
          <Box sx={{ display: { xs: 'none', md: 'flex' }, flex: 1, minWidth: 0, maxWidth: { md: '80%', lg: '85%' } }}>
            <NavLinks items={config.nav?.items || []} navTheme={navTheme} />
          </Box>
          <Box sx={{ display: { md: 'none' } }}>
            <NavLinks items={config.nav?.items || []} forceMobile navTheme={navTheme} />
          </Box>
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
                {user?.role === 'super_admin' && (
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
