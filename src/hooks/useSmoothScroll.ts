import { useEffect, useRef, useCallback } from 'react';

interface SmoothScrollOptions {
  
  lerp?: number;
  
  wheelMultiplier?: number;
  
  touchMultiplier?: number;
  
  enabled?: boolean;
  
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

    function onWheel(e: WheelEvent) {
      updateBounds();

      
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
      
      if (state.isProgrammaticScroll) {
        state.isProgrammaticScroll = false;
        return;
      }
      
      
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

    
    const observer = new MutationObserver(() => {
      updateBounds();
    });
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(state.rafId);
      state.active = false;
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
