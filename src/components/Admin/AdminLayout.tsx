import { Box, Toolbar, Fade } from '@mui/material';
import { useState, useRef, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import {
  AdminSideBar,
  AdminNavBar,
  adminDrawerWidth,
  adminMiniDrawerWidth,
  adminMobileDrawerWidth,
} from './AdminSideBar';
import { useUIStore } from '@/stores/uiStore';
import { useSmoothScroll } from '@/hooks/useSmoothScroll';
import { useSafeMediaQuery } from '@/hooks/useSafeMediaQuery';

export function AdminLayout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const adminNavHidden = useUIStore((state) => state.adminNavHidden);
  const { scrollToTop } = useSmoothScroll(mainRef, {
    lerp: 0.08,
    wheelMultiplier: 1,
    touchMultiplier: 1,
    disableOnTouch: true,
  });

  useEffect(() => {
    scrollToTop(true);
  }, [location.pathname, scrollToTop]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const isDesktop = useSafeMediaQuery((t) => t.breakpoints.up('md'), true);
  const currentDrawerWidth = isDesktop
    ? (collapsed ? adminMiniDrawerWidth : adminDrawerWidth)
    : adminMobileDrawerWidth;

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100dvh',
        height: '100dvh',
        width: '100%',
        overflow: 'hidden',
        backgroundColor: 'background.default',
      }}
    >
      <Box sx={{ display: adminNavHidden ? 'none' : 'block' }}>
        <AdminNavBar onMenuClick={handleDrawerToggle} />
      </Box>
      <AdminSideBar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <Box
        ref={mainRef}
        component="main"
        sx={{
          width: `calc(100% - ${currentDrawerWidth}px)`,
          flexGrow: 1,
          minWidth: 0,
          height: '100dvh',
          overflow: 'auto',
          transition: (theme) =>
            theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
          willChange: 'width',
        }}
      >
        <Box
          sx={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            p: { xs: 2, sm: 3, md: 4 },
          }}
        >
          <Toolbar sx={{ display: adminNavHidden ? 'none' : { md: 'none' } }} />
          <Box sx={{ flexGrow: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
            <Fade in timeout={400} key={location.pathname}>
              <Box sx={{ minWidth: 0, height: '100%' }}>
                <Outlet />
              </Box>
            </Fade>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
