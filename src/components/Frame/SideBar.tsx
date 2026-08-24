import {
  Box,
  Drawer,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  darken,
  lighten,
} from '@mui/material';
import { ChevronLeft, ChevronRight, Home, Info, LocalOffer, Login, Logout, Settings, AccountCircle, People, MusicNote, Forum } from '@mui/icons-material';
import { DRAWER_TRANSITION_MS, DrawerHeaderContainer, StyledNavButton, type NavItem } from './drawerShared';
import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { isContentAdmin } from '@/utils/permission';
import { useSiteStore } from '@/stores/siteStore';
import { useMessageWallEnabled } from '@/hooks/useMessageWallEnabled';
import { Logo } from '@/components/Common/Logo';
import { LogoutConfirmDialog } from '@/components/Common/LogoutConfirmDialog';

interface SideBarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export const drawerWidth = 260;
export const miniDrawerWidth = 56;
export const mobileDrawerWidth = 1;

const baseNavItems: NavItem[] = [
  { title: '首页', path: '/', icon: <Home fontSize="small" /> },
  { title: '标签', path: '/tag/all', icon: <LocalOffer fontSize="small" /> },
  { title: '留言墙', path: '/message-wall', icon: <Forum fontSize="small" /> },
  { title: '友链', path: '/friends', icon: <People fontSize="small" /> },
  { title: '关于', path: '/about', icon: <Info fontSize="small" /> },
  { title: '个人中心', path: '/profile', icon: <AccountCircle fontSize="small" /> },
  { title: '音乐', path: '/music', icon: <MusicNote fontSize="small" /> },
];

export function SideBar({ mobileOpen, onMobileClose }: SideBarProps) {
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { isAuthenticated, user, logout } = useAuthStore();
  const { config } = useSiteStore();
  const messageWallEnabled = useMessageWallEnabled();
  const [isAnimating, setIsAnimating] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const navItems = useMemo(() => {
    let items = [...baseNavItems];
    if (!config.friends?.enabled) {
      items = items.filter((item) => item.path !== '/friends');
    }
    if (!config.music?.showPage) {
      items = items.filter((item) => item.path !== '/music');
    }
    if (!messageWallEnabled) {
      items = items.filter((item) => item.path !== '/message-wall');
    }
    return items;
  }, [config.friends?.enabled, config.music?.showPage, messageWallEnabled]);

  const handleToggle = () => {
    setIsAnimating(true);
    toggleSidebar();
  };

  useEffect(() => {
    if (!isAnimating) return;
    const timer = setTimeout(() => setIsAnimating(false), DRAWER_TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [isAnimating, sidebarCollapsed]);

  const handleLogout = () => {
    if (isAuthenticated) {
      setLogoutOpen(true);
    }
    onMobileClose();
  };

  const drawerContent = (collapsed: boolean) => {
    
    if (collapsed) {
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
          {}
          <IconButton
            onClick={handleToggle}
            aria-label="展开侧边栏"
            className="live2d-tip-sidebar-expand"
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


          {}
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
            {navItems.map((item) => {
              const active =
                location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path));
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

            {isContentAdmin(user?.role) && (
              <Tooltip title="管理后台" placement="right">
                <IconButton
                  component={Link}
                  to="/admin"
                  aria-label="管理后台"
                  className="live2d-tip-admin"
                  size="small"
                  sx={{
                    color: location.pathname.startsWith('/admin') ? 'primary.main' : 'text.secondary',
                    width: 36,
                    height: 36,
                    borderRadius: 1,
                    backgroundColor: location.pathname.startsWith('/admin')
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
                  <Settings fontSize="small" />
                </IconButton>

              </Tooltip>

            )}
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
        {}
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
              className="live2d-tip-sidebar-collapse"
              size="small"
              sx={{ color: 'text.secondary' }}
            >
              <ChevronLeft />
            </IconButton>

          </Box>

        </DrawerHeaderContainer>


        {}
        <Stack
          sx={{
            flexGrow: 1,
            px: 1.5,
            py: 1,
            overflow: 'auto',
            gap: 0.5,
          }}
        >
          {navItems.map((item) => {
            const active =
              location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
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

          {}
          {isContentAdmin(user?.role) && (
            <StyledNavButton
              active={location.pathname.startsWith('/admin')}
              component={Link}
              to="/admin"
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
                <Settings fontSize="small" />
              </Box>

              <Typography variant="body2" fontWeight={600} noWrap>
                管理后台
              </Typography>

            </StyledNavButton>

          )}
        </Stack>


        {}
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

  const currentWidth = sidebarCollapsed ? miniDrawerWidth : drawerWidth;

  return (
    <>
      {}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
            bgcolor: 'background.default',
            borderRight: 'none',
            overflow: 'hidden',
          },
        }}
      >
        {drawerContent(false)}
      </Drawer>


      {}
      <Drawer
        variant="persistent"
        anchor="left"
        open
        sx={{
          display: 'block',
          width: { xs: `${mobileDrawerWidth}px`, md: currentWidth },
          flexShrink: 0,
          
          transition: (theme) =>
            theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: { xs: `${mobileDrawerWidth}px`, md: currentWidth },
            bgcolor: { xs: 'transparent', md: 'background.default' },
            borderRight: 'none',
            overflow: 'hidden',
            opacity: { xs: 0, md: 1 },
            pointerEvents: { xs: 'none', md: 'auto' },
            transition: (theme) =>
              theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
          },
        }}
      >
        <Box sx={{ display: { xs: 'none', md: 'block' }, height: '100%' }}>
          {isAnimating ? (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                bgcolor: 'background.default',
              }}
            />
          ) : (
            drawerContent(sidebarCollapsed)
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

export function SideBarHeaderSpacer() {
  return <Toolbar />;
}
