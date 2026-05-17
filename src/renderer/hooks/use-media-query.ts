import { useEffect, useState } from 'react';

/**
 * Reactive `matchMedia` helper. SSR-safe.
 *
 *   const compact = useMediaQuery('(max-width: 767.98px)');
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** Tailwind `md` breakpoint cutoff — viewport below 768 px. */
export function useCompactViewport(): boolean {
  return useMediaQuery('(max-width: 767.98px)');
}
