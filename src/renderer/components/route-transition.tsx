import { AnimatePresence, motion } from 'motion/react';
import { useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';

/**
 * Subtle fade + 6px rise on every route change. Keyed by the deepest
 * matched route so child routes re-mount and animate naturally.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const matches = useRouterState({ select: (s) => s.matches });
  const last = matches[matches.length - 1];
  const key = last?.id ?? last?.pathname ?? 'root';

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={key}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="flex h-full min-h-0 flex-1 flex-col"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
