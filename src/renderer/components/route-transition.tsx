import { motion } from 'motion/react';
import { useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';

/**
 * Subtle fade + 6px rise on every top-level page change.
 *
 * Why no <AnimatePresence>: with mode="wait" + an Outlet child, the
 * exiting div keeps rendering the *new* matched route's content during
 * its exit (Outlet doesn't snapshot), so the user sees the new screen
 * flash in, then animate again. With just a keyed motion.div, React
 * unmounts the old subtree the moment the key changes and the new one
 * mounts at `initial` state — single, clean fade-in.
 *
 * Key derivation: top two URL segments only. That way `/app/bots`,
 * `/app/bots/12345`, `/app/bots/67890` all share a key, so switching
 * between Bots doesn't re-animate the whole BotsView chrome.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const key = topSegments(pathname);

  return (
    <motion.div
      key={key}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-full min-h-0 flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}

function topSegments(pathname: string): string {
  const segs = pathname.split('/').filter(Boolean);
  return '/' + segs.slice(0, 2).join('/');
}
