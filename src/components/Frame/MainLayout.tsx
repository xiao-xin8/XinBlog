import { Box, Toolbar, Fade } from '@mui/material';
import { useRef, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { NavBar } from './NavBar';
import { SideBar, drawerWidth, miniDrawerWidth, mobileDrawerWidth } from './SideBar';
import { Footer } from './Footer';
import { Live2DWidget } from '@/components/Live2D/Live2DWidget';
import { useUIStore } from '@/stores/uiStore';
import { useSiteStore } from '@/stores/siteStore';
import { useSmoothScroll } from '@/hooks/useSmoothScroll';
import { useSafeMediaQuery } from '@/hooks/useSafeMediaQuery';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { sidebarCollapsed } = useUIStore();
  const { config } = useSiteStore();
  const mainRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const { scrollToTop } = useSmoothScroll(mainRef, {
    lerp: 0.08,
    wheelMultiplier: 1,
    touchMultiplier: 1,
    disableOnTouch: true,
  });

  const hasBackground = Boolean(config.backgroundImage);
  const backgroundOpacity = config.backgroundOpacity ?? 1;
  const backgroundBlur = config.backgroundBlur ?? 0;

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  useEffect(() => {
    scrollToTop(true);
  }, [location.pathname, scrollToTop]);

  const isDesktop = useSafeMediaQuery((t) => t.breakpoints.up('md'), true);
  const currentDrawerWidth = isDesktop
    ? (sidebarCollapsed ? miniDrawerWidth : drawerWidth)
    : mobileDrawerWidth;

  return (
    <Box
      sx={{
        position: 'relative',
        zIndex: 0,
        display: 'flex',
        minHeight: '100dvh',
        height: '100dvh',
        width: '100%',
        overflow: 'hidden',
        bgcolor: 'transparent',
      }}
    >
      {hasBackground && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: -1,
            backgroundImage: `url(${config.backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: backgroundOpacity,
            filter: backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : undefined,
            transform: backgroundBlur > 0 ? 'scale(1.05)' : undefined,
          }}
        />
      )}
      <NavBar
        onMenuClick={handleDrawerToggle}
        drawerOpen
        drawerWidth={currentDrawerWidth}
        scrollTargetRef={mainRef}
      />
      <SideBar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <Box
        ref={mainRef}
        component="main"
        sx={{
          position: 'relative',
          zIndex: 0,
          width: `calc(100% - ${currentDrawerWidth}px)`,
          flexGrow: 1,
          minWidth: 0,
          height: '100dvh',
          overflow: 'auto',
          bgcolor: hasBackground ? 'transparent' : 'background.default',
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
            px: { xs: 2, md: 0 },
          }}
        >
          <Toolbar />
          <Box sx={{ flexGrow: 1 }}>
            <Fade in timeout={400} key={location.pathname}>
              <Box sx={{ minHeight: '100%' }}>{children}</Box>
            </Fade>
          </Box>
          <Footer />
        </Box>
      </Box>
      <Live2DWidget />
    </Box>
  );
}
