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
import { resolveSpacingConfig } from '@/utils/spacingConfig';

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
    enabled: !config.disableSmoothScroll,
  });

  const hasBackground = Boolean(config.backgroundImage);
  const backgroundOpacity = config.backgroundOpacity ?? 1;
  const backgroundBlur = config.backgroundBlur ?? 0;
  const spacing = resolveSpacingConfig(config.spacing);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  useEffect(() => {
    scrollToTop(true);
  }, [location.pathname, scrollToTop]);

  // 聊天房间页 / Agent 页沉浸式：隐藏顶栏/页脚，页面本身不滚动，滚动交由消息列表内部处理。
  //// 注意：仅对 `/chat/:roomKey` 房间路由和 `/agent/:dialogId` 对话路由生效，`/chat`「/agent」列表页保持正常布局。
  const isImmersive = location.pathname.startsWith('/chat/') || location.pathname.startsWith('/agent/');

  // 全屏英雄区：仅首页 + fullscreen 模式下生效，此时顶部导航透明悬浮。
  // 侧边栏布局与顶部栏布局共用此信号（两者只差侧边栏是否存在，透明逻辑一致）。
  const isFullscreenHero = location.pathname === '/' && config.hero?.mode === 'fullscreen';

  // 导航布局为顶部栏：正常页面用顶部导航栏，沉浸式页面则完全隐藏导航（既无侧边栏也无顶栏）。
  // 侧边栏布局保持原样：沉浸式页面仍保留侧边栏以便返回。
  const useTopNav = config.nav?.layout === 'top';
  const isDesktop = useSafeMediaQuery((t) => t.breakpoints.up('md'), true);
  const currentDrawerWidth = useTopNav
    ? 0
    : isDesktop
      ? (sidebarCollapsed ? miniDrawerWidth : drawerWidth)
      : mobileDrawerWidth;

  // 背景层（透明主题时可为 null）
  const backgroundLayer = hasBackground ? (
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
  ) : null;

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
      {backgroundLayer}
      {!isImmersive && (
        <NavBar
          onMenuClick={handleDrawerToggle}
          drawerOpen={!useTopNav}
          drawerWidth={currentDrawerWidth}
          scrollTargetRef={mainRef}
          layout={useTopNav ? 'top' : 'sidebar'}
          transparent={isFullscreenHero}
        />
      )}
      {/* 顶部栏布局下不渲染侧边栏（沉浸式页面同样不渲染，此时导航完全隐藏） */}
      {!useTopNav && (
        <SideBar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      )}
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
          overflow: isImmersive ? 'hidden' : 'auto',
          bgcolor: isImmersive || hasBackground ? 'transparent' : 'background.default',
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
            px: isImmersive
              ? 0
              : { xs: `${spacing.mainPaddingX.mobile}px`, md: `${spacing.mainPaddingX.desktop}px` },
          }}
        >
          {!isImmersive && !isFullscreenHero && <Toolbar />}
          <Box sx={isImmersive ? { flex: 1, height: '100dvh', minHeight: 0 } : { flexGrow: 1 }}>
            <Fade in timeout={400} key={location.pathname}>
              <Box
                sx={{
                  height: isImmersive ? '100dvh' : 'auto',
                  minHeight: isImmersive ? undefined : '100%',
                }}
              >
                {children}
              </Box>
            </Fade>
          </Box>
          {!isImmersive && <Footer />}
        </Box>
      </Box>
      {!isImmersive && <Live2DWidget />}
    </Box>
  );
}
