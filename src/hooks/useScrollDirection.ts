import { useState, useEffect, useRef, type RefObject } from 'react';

export interface ScrollDirectionState {
  
  hidden: boolean;
  
  scrollY: number;
}


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

        
        if (current <= threshold) {
          setHidden(false);
        } else if (delta > 8) {
          
          setHidden(true);
        } else if (delta < -8) {
          
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
