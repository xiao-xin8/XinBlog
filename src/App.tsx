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
    if (state.borderRadius > 16) {
      useThemeConfigStore.setState({ borderRadius: 16 });
    }
    
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

  
  useEffect(() => {
    let timer: number | undefined;

    const scheduleRefresh = () => {
      window.clearTimeout(timer);
      const { isAuthenticated, token, refresh } = useAuthStore.getState();
      if (!isAuthenticated || !token) return;

      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (!payload.exp) return;

        const expiresAt = payload.exp * 1000;
        const refreshAt = expiresAt - 5 * 60 * 1000; 
        const delay = refreshAt - Date.now();

        if (delay <= 0) {
          refresh();
        } else {
          timer = window.setTimeout(() => refresh(), delay);
        }
      } catch {
        // token 格式异常，忽略定时刷新
      }
    };

    scheduleRefresh();
    const unsubscribe = useAuthStore.subscribe((state, prevState) => {
      if (state.isAuthenticated && !prevState.isAuthenticated) {
        scheduleRefresh();
      }
      if (!state.isAuthenticated && prevState.isAuthenticated) {
        window.clearTimeout(timer);
      }
    });

    return () => {
      window.clearTimeout(timer);
      unsubscribe();
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
