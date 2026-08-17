import { useEffect, useRef } from 'react';
import { useSiteStore } from '@/stores/siteStore';
import type { Live2dConfig } from '@/types';

const CSS_ID = 'live2d-widget-css';
const CUSTOM_STYLE_ID = 'live2d-widget-custom-style';
const INIT_CHECK_INTERVAL = 50;
const OFFICIAL_CDN = 'https://fastly.jsdelivr.net/gh/fghrsh/live2d_api/';

interface Live2dWindow extends Window {
  initWidget?: (config: Record<string, unknown>) => void;
  __live2d_initialized?: boolean;
}

function loadCss(href: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(CSS_ID) as HTMLLinkElement | null;
    if (existing) {
      resolve();
      return;
    }
    const link = document.createElement('link');
    link.id = CSS_ID;
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load ${href}`));
    document.head.appendChild(link);
  });
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.type = 'module';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function removeWidgetDom() {
  document.getElementById('waifu')?.remove();
  document.getElementById('waifu-toggle')?.remove();
}

function removeStyles() {
  document.getElementById(CSS_ID)?.remove();
  document.getElementById(CUSTOM_STYLE_ID)?.remove();
}

function cleanupWidget() {
  removeWidgetDom();
  removeStyles();
  const win = window as unknown as Live2dWindow;
  win.__live2d_initialized = false;
}

function setLoading(loading: boolean) {
  const canvas = document.getElementById('waifu-canvas');
  if (!canvas) return;
  canvas.classList.toggle('live2d-loading', loading);
}

function isMobileScreen() {
  return window.innerWidth <= 768;
}

const LOCAL_MODEL_PATH = '/live2d-models/';

async function resolveCdnPath(modelSource: 'local' | 'cdn', customCdn?: string): Promise<string> {
  
  const fallback = customCdn?.trim() || OFFICIAL_CDN;
  
  if (modelSource === 'cdn') return fallback;
  
  try {
    const res = await fetch(`${LOCAL_MODEL_PATH}model_list.json`, {
      method: 'HEAD',
      cache: 'no-store',
    });
    if (res.ok) return LOCAL_MODEL_PATH;
  } catch {
    // ignore
  }
  return fallback;
}

function applyCustomStyles(config: Live2dConfig) {
  let style = document.getElementById(CUSTOM_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = CUSTOM_STYLE_ID;
    document.head.appendChild(style);
  }

  const isLeft = config.position === 'left';
  const position = isLeft ? 'left: 0; right: auto;' : 'right: 0; left: auto;';
  const transformOrigin = isLeft ? 'left bottom' : 'right bottom';
  const isMobile = isMobileScreen();
  const width = isMobile && config.mobileWidth ? config.mobileWidth : config.width;
  const height = isMobile && config.mobileHeight ? config.mobileHeight : config.height;

  style.textContent = `
    #waifu {
      position: fixed !important;
      ${position}
      width: ${width}px;
      height: ${height}px;
      transform-origin: ${transformOrigin};
      z-index: 9999;
      transform: none !important;
      max-width: 100vw;
      max-height: 100vh;
    }
    #waifu:hover {
      transform: translateY(-4px) !important;
    }
    #waifu-canvas {
      width: ${width}px;
      height: ${height}px;
      position: relative;
      overflow: hidden;
    }
    #waifu-canvas canvas {
      width: ${width}px !important;
      height: ${height}px !important;
      display: block;
    }
    #waifu-canvas::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 32px;
      height: 32px;
      margin: -16px 0 0 -16px;
      border: 3px solid rgba(127, 127, 127, 0.2);
      border-top-color: #0099cc;
      border-radius: 50%;
      animation: live2d-spin 1s linear infinite;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s;
      z-index: 1;
    }
    #waifu-canvas.live2d-loading::before {
      opacity: 1;
    }
    @keyframes live2d-spin {
      to { transform: rotate(360deg); }
    }
    #waifu-toggle {
      position: fixed !important;
      ${position}
      ${isLeft ? 'margin-left: -100px; margin-right: 0;' : 'margin-right: -100px; margin-left: 0;'}
      justify-content: ${isLeft ? 'flex-end' : 'flex-start'};
      z-index: 9999;
    }
    #waifu-toggle.waifu-toggle-active {
      ${isLeft ? 'margin-left: -50px;' : 'margin-right: -50px;'}
    }
    #waifu-toggle.waifu-toggle-active:hover {
      ${isLeft ? 'margin-left: -30px;' : 'margin-right: -30px;'}
    }
    #waifu-tool {
      top: auto;
      bottom: 16px;
      right: -10px;
      max-height: calc(${height}px - 32px);
      overflow: hidden;
    }
  `;
}

async function initLive2d(config: Live2dConfig) {
  const win = window as unknown as Live2dWindow;
  if (win.__live2d_initialized) {
    applyCustomStyles(config);
    return;
  }

  localStorage.removeItem('waifu-disabled');
  localStorage.removeItem('waifu-display');

  applyCustomStyles(config);

  const cdnPath = await resolveCdnPath(config.modelSource, config.customCdn);

  win.initWidget?.({
    waifuPath: config.waifuPath,
    cdnPath,
    cubism2Path: config.cubism2Path,
    cubism5Path: config.cubism5Path,
    tools: config.tools,
    drag: config.drag,
    showToggleAfterQuit: config.showToggleAfterQuit,
    logLevel: config.logLevel,
  });

  win.__live2d_initialized = true;
}

export function Live2DWidget() {
  const config = useSiteStore((state) => state.config.live2d);
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  });

  useEffect(() => {
    const cfg = configRef.current;
    if (!cfg || !cfg.enabled) {
      cleanupWidget();
      return;
    }
    if (isMobileScreen() && !cfg.mobileEnabled) {
      cleanupWidget();
      return;
    }

    let cancelled = false;
    let checkTimer: ReturnType<typeof setInterval> | null = null;

    const onLoading = () => setLoading(true);
    const onLoaded = () => setLoading(false);

    const shouldShow = () => !isMobileScreen() || cfg.mobileEnabled;

    const startInit = async () => {
      try {
        await loadCss('/live2d/waifu.css');
        if (cancelled) return;
        await loadScript('/live2d/waifu-tips.js');
        if (cancelled) return;

        window.addEventListener('live2d-loading', onLoading);
        window.addEventListener('live2d-loaded', onLoaded);

        checkTimer = setInterval(() => {
          if (cancelled) {
            if (checkTimer) clearInterval(checkTimer);
            return;
          }
          const win = window as unknown as Live2dWindow;
          if (typeof win.initWidget === 'function') {
            if (checkTimer) clearInterval(checkTimer);
            initLive2d(configRef.current!);
          }
        }, INIT_CHECK_INTERVAL);
      } catch {
        // 静态资源加载失败时静默失败，不影响页面主体功能
      }
    };

    startInit();

    const handleResize = () => {
      if (!shouldShow()) {
        cleanupWidget();
        return;
      }
      const win = window as unknown as Live2dWindow;
      if (!win.__live2d_initialized) {
        startInit();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelled = true;
      if (checkTimer) clearInterval(checkTimer);
      window.removeEventListener('live2d-loading', onLoading);
      window.removeEventListener('live2d-loaded', onLoaded);
      window.removeEventListener('resize', handleResize);
    };
  }, [config]);

  return null;
}
