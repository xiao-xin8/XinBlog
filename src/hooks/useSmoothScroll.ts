import { useEffect, useRef, useCallback } from 'react';
import { registerSmoothScroll, type SmoothScrollApi } from '@/utils/smoothScrollController';

interface SmoothScrollOptions {
  /** 插值系数，越小越平滑，越大越跟手 (0-1) */
  lerp?: number;
  /** 滚轮灵敏度 */
  wheelMultiplier?: number;
  /** 触摸灵敏度；建议保持 1，避免页面滚动距离超过手指移动距离 */
  touchMultiplier?: number;
  /** 是否启用自定义滚动；禁用时完全回退到原生滚动 */
  enabled?: boolean;
  /** 是否在触摸设备上禁用自定义滚动（默认 true），回退到原生惯性滚动 */
  disableOnTouch?: boolean;
}

export function useSmoothScroll(
  containerRef: React.RefObject<HTMLElement | null>,
  options: SmoothScrollOptions = {}
) {
  const {
    lerp = 0.12,
    wheelMultiplier = 1,
    touchMultiplier = 1,
    enabled = true,
    disableOnTouch = true,
  } = options;

  const stateRef = useRef({
    target: 0,
    current: 0,
    maxScroll: 0,
    rafId: 0,
    active: false,
    /** 标记本次 scroll 事件是否由代码设置 scrollTop 触发 */
    isProgrammaticScroll: false,
  });

  const updateBounds = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    stateRef.current.maxScroll = Math.max(
      0,
      container.scrollHeight - container.clientHeight
    );
    stateRef.current.target = Math.max(
      0,
      Math.min(stateRef.current.target, stateRef.current.maxScroll)
    );
  }, [containerRef]);

  const scrollToTop = useCallback(
    (immediate = false) => {
      const container = containerRef.current;
      if (!container) return;

      stateRef.current.target = 0;
      stateRef.current.current = 0;
      stateRef.current.isProgrammaticScroll = true;
      container.scrollTop = 0;
      stateRef.current.active = false;

      if (immediate) {
        cancelAnimationFrame(stateRef.current.rafId);
      }
    },
    [containerRef]
  );

  useEffect(() => {
    const container = containerRef.current;
    const isTouchDevice =
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: coarse)').matches;
    const shouldEnable = enabled && !(disableOnTouch && isTouchDevice);
    if (!container || !shouldEnable) return;

    const state = stateRef.current;
    state.current = container.scrollTop;
    state.target = container.scrollTop;
    updateBounds();

    function clamp(value: number) {
      return Math.max(0, Math.min(value, state.maxScroll));
    }

    function render() {
      if (!container) return;
      const diff = state.target - state.current;

      if (Math.abs(diff) < 0.5) {
        state.current = state.target;
        state.isProgrammaticScroll = true;
        container.scrollTop = state.current;
        state.active = false;
        return;
      }

      state.current += diff * lerp;
      state.isProgrammaticScroll = true;
      container.scrollTop = state.current;
      state.rafId = requestAnimationFrame(render);
    }

    function startRender() {
      if (!state.active) {
        state.active = true;
        state.rafId = requestAnimationFrame(render);
      }
    }

    // 将 lerp 滚动能力注册给外部调用方（目录/回到顶部等），
    // 使其以相兼容的方式滚动，避免原生 scrollTo 与 lerp 冲突导致锚点失效
    const relaxedApi: SmoothScrollApi = {
      scrollTo: (target: number) => {
        updateBounds();
        state.target = clamp(target);
        startRender();
      },
      updateBounds,
    };
    registerSmoothScroll(relaxedApi);

    function onWheel(e: WheelEvent) {
      updateBounds();

      // 没有可滚动区域时不拦截原生滚动
      if (state.maxScroll <= 0) return;

      e.preventDefault();
      state.target = clamp(state.target + e.deltaY * wheelMultiplier);
      startRender();
    }

    let lastTouchY = 0;

    function onTouchStart(e: TouchEvent) {
      lastTouchY = e.touches[0].clientY;
    }

    function onTouchMove(e: TouchEvent) {
      updateBounds();
      if (state.maxScroll <= 0) return;

      e.preventDefault();
      const y = e.touches[0].clientY;
      const delta = lastTouchY - y;
      lastTouchY = y;
      state.target = clamp(state.target + delta * touchMultiplier);
      startRender();
    }

    function onResize() {
      updateBounds();
    }

    function onScroll() {
      if (!container) return;
      // 代码设置 scrollTop 会触发 scroll 事件，此时无需同步
      if (state.isProgrammaticScroll) {
        state.isProgrammaticScroll = false;
        // 但若浏览器因内容高度变化（路由切换/内容重置）把 scrollTop 改写为与目标不一致的值，
        // 需要立即同步，避免残留的 target 在下一次滚轮时把页面拉回旧位置
        if (Math.abs(container.scrollTop - state.current) > 0.5) {
          state.target = container.scrollTop;
          state.current = container.scrollTop;
          state.active = false;
          cancelAnimationFrame(state.rafId);
        }
        return;
      }
      // 用户手动拖动滚动条或使用键盘导航时，立即同步目标位置，
      // 避免下一次滚轮事件把页面拉回到拖动前的位置
      state.target = container.scrollTop;
      state.current = container.scrollTop;
      state.active = false;
      cancelAnimationFrame(state.rafId);
    }

    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    // 内容动态变化时重新计算滚动边界
    const observer = new MutationObserver(() => {
      updateBounds();
    });
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(state.rafId);
      state.active = false;
      registerSmoothScroll(null);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      observer.disconnect();
    };
  }, [
    containerRef,
    enabled,
    lerp,
    wheelMultiplier,
    touchMultiplier,
    disableOnTouch,
    updateBounds,
  ]);

  return { scrollToTop, updateBounds };
}
