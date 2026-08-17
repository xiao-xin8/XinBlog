import { useState, useEffect } from 'react';
import { useTheme, type Theme } from '@mui/material/styles';






export function useSafeMediaQuery(queryFn: (theme: Theme) => string, defaultMatches = false): boolean {
  const theme = useTheme();
  const query = queryFn(theme);
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return defaultMatches;
    try {
      return window.matchMedia(query).matches;
    } catch {
      return defaultMatches;
    }
  });

  useEffect(() => {
    let mql: MediaQueryList | undefined;
    try {
      mql = window.matchMedia(query);
      setMatches(mql.matches);
      const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
      mql.addEventListener('change', handler);
      return () => mql?.removeEventListener('change', handler);
    } catch {
      return undefined;
    }
  }, [query]);

  return matches;
}
