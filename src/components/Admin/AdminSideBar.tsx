import {
  Box,
  Drawer,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  alpha,
  darken,
  lighten,
} from '@mui/material';
import { DRAWER_TRANSITION_MS, DrawerHeaderContainer, StyledNavButton, type NavItem } from '../Frame/drawerShared';
import {
  Article,
  AutoAwesome,
  Chat,
  ChevronLeft,
  ChevronRight,
  Dashboard,
  Diversity3,
  Group,
  Home,
  Label,
  Login,
  Logout,
  Menu as MenuIcon,
  Palette,
  PermMedia,
  Settings,
  Style,
} from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Logo } from '@/components/Common/Logo';
import { LogoutConfirmDialog } from '@/components/Common/LogoutConfirmDialog';

export const adminDrawerWidth = 260;
export const adminMiniDrawerWidth = 56;
export const adminMobileDrawerWidth = 1;

interface AdminSideBarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const adminNavItems: NavItem[] = [
  { title: '概览', path: '/admin', icon: <Dashboard fontSize="small" /> },
  { title: '文章', path: '/admin/posts', icon: <Article fontSize="small" /> },
  { title: '标签', path: '/admin/tags', icon: <Label fontSize="small" /> },
  { title: '媒体管理', path: '/admin/media', icon: <PermMedia fontSize="small" /> },
  { title: '评论管理', path: '/admin/comments', icon: <Chat fontSize="small" /> },
  { title: '友链管理', path: '/admin/friends', icon: <Diversity3 fontSize="small" /> },
  { title: 'AI', path: '/admin/ai', icon: <AutoAwesome fontSize="small" /> },
  { title: '外观设置', path: '/admin/appearance', icon: <Palette fontSize="small" /> },
  { title: '主题设置', path: '/admin/themes', icon: <Style fontSize="small" /> },
  { title: '高级设置', path: '/admin/advanced', icon: <Settings fontSize="small" /> },
  { title: '用户管理', path: '/admin/users', icon: <Group fontSize="small" /> },
];

export function AdminSideBar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}: AdminSideBarProps) {
  const location = useLocation();
  const { isAuthenticated, user, logout } = useAuthStore();
  const [isAnimating, setIsAnimating] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const handleToggle = () => {
    setIsAnimating(true);
    onToggle();
  };

  useEffect(() => {
    if (!isAnimating) return;
    const timer = setTimeout(() => setIsAnimating(false), DRAWER_TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [isAnimating, collapsed]);

  const handleLogout = () => {
    if (isAuthenticated) {
      setLogoutOpen(true);
    }
    onMobileClose();
  };

  const drawerContent = (isCollapsed: boolean) => {
    
    if (isCollapsed) {
      return (
        <Box
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            bgcolor: 'background.default',
            overflow: 'hidden',
            py: 1.5,
            px: 1,
          }}
        >
          {/* Expand button on top */}
          <IconButton
            onClick={handleToggle}
            aria-label="展开侧边栏"
            size="small"
            sx={{
              color: 'text.secondary',
              width: 36,
              height: 36,
              borderRadius: 1,
              mb: 1,
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <ChevronRight />
          </IconButton>

          {/* Mini Navigation */}
          <Stack
            sx={{
              flexGrow: 1,
              alignItems: 'center',
              gap: 0.75,
              py: 1,
              overflow: 'auto',
              width: '100%',
            }}
          >
            {adminNavItems.map((item) => {
              const active =
                item.path === '/admin'
                  ? location.pathname === '/admin'
                  : location.pathname.startsWith(item.path);
              return (
                <Tooltip key={item.path} title={item.title} placement="right">
                  <IconButton
                    component={Link}
                    to={item.path}
                    aria-label={item.title}
                    size="small"
                    sx={{
                      color: active ? 'primary.main' : 'text.secondary',
                      width: 36,
                      height: 36,
                      borderRadius: 1,
                      backgroundColor: active
                        ? (theme) =>
                            theme.palette.mode === 'light'
                              ? lighten(theme.palette.primary.main, 0.7)
                              : darken(theme.palette.primary.main, 0.7)
                        : 'transparent',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                    }}
                  >
                    {item.icon}
                  </IconButton>
                </Tooltip>
              );
            })}

            <Tooltip title="返回首页" placement="right">
              <IconButton
                component={Link}
                to="/"
                aria-label="返回首页"
                size="small"
                sx={{
                  color: location.pathname === '/' ? 'primary.main' : 'text.secondary',
                  width: 36,
                  height: 36,
                  borderRadius: 1,
                  backgroundColor: location.pathname === '/'
                    ? (theme) =>
                        theme.palette.mode === 'light'
                          ? lighten(theme.palette.primary.main, 0.7)
                          : darken(theme.palette.primary.main, 0.7)
                    : 'transparent',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <Home fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      );
    }

    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <DrawerHeaderContainer>
          <Box sx={{ width: '100%', pl: 1.5, cursor: 'pointer', textDecoration: 'none' }} component={Link} to="/">
            <Logo />
          </Box>
          <Box>
            <IconButton
              onClick={() => {
                handleToggle();
                onMobileClose();
              }}
              aria-label="收起侧边栏"
              size="small"
              sx={{ color: 'text.secondary' }}
            >
              <ChevronLeft />
            </IconButton>
          </Box>
        </DrawerHeaderContainer>

        {/* Navigation - 独立滚动区域 */}
        <Stack
          sx={{
            flexGrow: 1,
            px: 1.5,
            py: 1,
            overflow: 'auto',
            gap: 0.5,
          }}
        >
          {adminNavItems.map((item) => {
            const active =
              item.path === '/admin'
                ? location.pathname === '/admin'
                : location.pathname.startsWith(item.path);
            return (
              <StyledNavButton
                key={item.path}
                active={active}
                component={Link}
                to={item.path}
                onClick={onMobileClose}
                sx={{
                  justifyContent: 'flex-start',
                  px: 1.5,
                }}
              >
                <Box
                  sx={{
                    width: 20,
                    mr: 1.75,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {item.icon}
                </Box>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {item.title}
                </Typography>
              </StyledNavButton>
            );
          })}

          {/* Back to home */}
          <StyledNavButton
            component={Link}
            to="/"
            onClick={onMobileClose}
            sx={{
              justifyContent: 'flex-start',
              px: 1.5,
            }}
          >
            <Box
              sx={{
                width: 20,
                mr: 1.75,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Home fontSize="small" />
            </Box>
            <Typography variant="body2" fontWeight={600} noWrap>
              返回首页
            </Typography>
          </StyledNavButton>
        </Stack>

        {/* Footer */}
        <Box
          sx={{
            px: 1.5,
            py: 1,
            borderTop: '1px solid',
            borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          <StyledNavButton
            component={Link}
            to={isAuthenticated ? '#' : '/admin/login'}
            onClick={handleLogout}
            sx={{
              justifyContent: 'flex-start',
              px: 1.5,
            }}
          >
            <Box
              sx={{
                width: 20,
                mr: 1.75,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isAuthenticated ? <Logout fontSize="small" /> : <Login fontSize="small" />}
            </Box>
            <Typography variant="body2" fontWeight={600} noWrap>
              {isAuthenticated && user ? user.username : '登录'}
            </Typography>
          </StyledNavButton>
        </Box>
      </Box>
    );
  };

  const currentWidth = collapsed ? adminMiniDrawerWidth : adminDrawerWidth;

  return (
    <>
      {/* 移动端抽屉 */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', lg: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: adminDrawerWidth,
            bgcolor: 'background.default',
            borderRight: 'none',
            overflow: 'hidden',
          },
        }}
      >
        {drawerContent(false)}
      </Drawer>

      {/* 桌面端侧边栏；移动端保留一个 1px 的占位侧边栏，保持布局结构一致 */}
      <Drawer
        variant="persistent"
        anchor="left"
        open
        sx={{
          display: 'block',
          width: { xs: `${adminMobileDrawerWidth}px`, lg: currentWidth },
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: { xs: `${adminMobileDrawerWidth}px`, lg: currentWidth },
            bgcolor: { xs: 'transparent', lg: 'background.default' },
            borderRight: 'none',
            overflow: 'hidden',
            opacity: { xs: 0, lg: 1 },
            pointerEvents: { xs: 'none', lg: 'auto' },
            transition: (theme) =>
              theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
          },
        }}
      >
        <Box sx={{ display: { xs: 'none', lg: 'block' }, height: '100%' }}>
          {isAnimating ? (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                bgcolor: 'background.default',
              }}
            />
          ) : (
            drawerContent(collapsed)
          )}
        </Box>
      </Drawer>
      <LogoutConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          logout();
        }}
      />
    </>
  );
}

export function AdminNavBar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: (theme) => theme.zIndex.drawer + 1,
        display: { lg: 'none' },
      }}
    >
      <Toolbar
        sx={{
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          px: { xs: 2, sm: 3 },
          backgroundColor: (theme) =>
            alpha(
              theme.palette.background.paper,
              theme.palette.mode === 'light' ? 0.9 : 0.9
            ),
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
          <IconButton
            onClick={onMenuClick}
            aria-label="打开管理菜单"
            sx={{ color: 'text.primary', flexShrink: 0, width: 44, height: 44 }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexShrink: 1, minWidth: 0, overflow: 'hidden' }}>
            <Logo />
          </Box>
        </Box>
      </Toolbar>
    </Box>
  );
}
