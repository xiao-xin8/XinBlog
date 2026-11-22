import { useEffect, useState } from 'react';
import { ThemeProvider, CssBaseline, GlobalStyles, alpha } from '@mui/material';
import { RouterProvider } from 'react-router-dom';
import { useAppTheme } from '@/theme';
import { router } from '@/router';
import { useThemeConfigStore } from '@/stores/themeConfigStore';
import { useSiteStore } from '@/stores/siteStore';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { Loading } from '@/components/Common/Loading';
import { SceneThemeEffects } from '@/themes/scene';
import { ClickEffect } from '@/components/ClickEffect';
import { GlobalMusicPlayer } from '@/components/MusicPlayer/GlobalMusicPlayer';
import { MusicPlayerProvider } from '@/components/MusicPlayer/MusicPlayerContext';
import { DISABLE_CONTEXT_MENU } from '@/config';

function GlobalScrollbarStyles() {
  return (
    <GlobalStyles
      styles={(theme) => ({
        '*': {
          scrollbarWidth: 'thin',
          scrollbarColor: `${
            theme.palette.mode === 'light'
              ? alpha(theme.palette.primary.main, 0.3)
              : alpha(theme.palette.common.white, 0.2)
          } transparent`,
        },
        html: {
          scrollBehavior: 'smooth',
        },
        '@media (hover: hover) and (pointer: fine)': {
          '*::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '*::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor:
              theme.palette.mode === 'light'
                ? alpha(theme.palette.primary.main, 0.3)
                : alpha(theme.palette.common.white, 0.2),
            borderRadius: `${Math.max(4, theme.shape.borderRadius / 2)}px`,
          },
          '*::-webkit-scrollbar-thumb:hover': {
            backgroundColor:
              theme.palette.mode === 'light'
                ? alpha(theme.palette.primary.main, 0.5)
                : alpha(theme.palette.common.white, 0.3),
          },
        },
      })}
    />
  );
}

function App() {
  const theme = useAppTheme();
  const [initialized, setInitialized] = useState(false);
  const music = useSiteStore((s) => s.config.music);

  useEffect(() => {
    const state = useThemeConfigStore.getState();
    if (state.borderRadius > 32) {
      useThemeConfigStore.setState({ borderRadius: 32 });
    }
    // 从后端加载站点/主题/布局配置（先加载站点配置，再同步主题和布局）
    const init = async () => {
      await useSiteStore.getState().loadConfig();
      await useThemeConfigStore.getState().loadConfig();
      await useUIStore.getState().loadConfig();
      setInitialized(true);
    };
    init();
  }, []);

  useEffect(() => {
    if (!DISABLE_CONTEXT_MENU) return;
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  // token 自动续期（微信式常驻会话）：
  // 已登录时每分钟检查一次，临近过期（<5 分钟）才静默刷新，从而把 refresh token 持续滑动到 30 天窗口；
  // 标签页切回前台时也立即补一次，规避浏览器对后台标签页 setTimeout/setInterval 的节流导致漏刷。
  // ensureSession 内部已做单飞，并发调用不会重复刷新。
  useEffect(() => {
    const tick = () => {
      void useAuthStore.getState().ensureSession();
    };
    tick();
    const interval = window.setInterval(tick, 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalScrollbarStyles />
      <SceneThemeEffects />
      <ClickEffect />
      {initialized ? (
        <MusicPlayerProvider config={music}>
          <RouterProvider router={router} />
          <GlobalMusicPlayer />
        </MusicPlayerProvider>
      ) : (
        <Loading fullScreen text="正在加载站点配置..." />
      )}
    </ThemeProvider>
  );
}

export default App;
