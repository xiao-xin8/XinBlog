import { useState, useEffect, useRef, type RefObject } from 'react';

export interface ScrollDirectionState {
  /** 当前是否处于隐藏状态（向下滚动时隐藏，向上滚动时显示） */
  hidden: boolean;
  /** 当前滚动位置 */
  scrollY: number;
}

/**
 * 监听页面滚动方向，用于导航栏等元素的自动隐藏/显示。
 * 规则：向下滚动超过阈值后隐藏，向上滚动时显示；靠近顶部时始终显示。
 * @param threshold 距离顶部多少像素内始终显示
 * @param targetRef 自定义滚动容器，不传则监听 window
 */
export function useScrollDirection(threshold = 64, targetRef?: RefObject<HTMLElement | null>): ScrollDirectionState {
  const [hidden, setHidden] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const lastScrollY = useRef(0);

  useEffect(() => {
    let rafId: number;
    let pendingScrollY = 0;
    const target = targetRef?.current ?? window;

    const getScrollY = () =>
      target instanceof Window ? target.scrollY : target.scrollTop;

    const handleScroll = () => {
      pendingScrollY = getScrollY();
      if (rafId) return;

      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const current = pendingScrollY;
        const previous = lastScrollY.current;
        const delta = current - previous;

        // 靠近顶部时始终显示
        if (current <= threshold) {
          setHidden(false);
        } else if (delta > 8) {
          // 向下滚动，隐藏
          setHidden(true);
        } else if (delta < -8) {
          // 向上滚动，显示
          setHidden(false);
        }

        lastScrollY.current = current;
        setScrollY(current);
      });
    };

    target.addEventListener('scroll', handleScroll, { passive: true });
    lastScrollY.current = getScrollY();
    setScrollY(lastScrollY.current);

    return () => {
      target.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [threshold, targetRef]);

  return { hidden, scrollY };
}
