import { useEffect } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { TooltipProvider } from '@snowluma/ui';
import { trpc } from './lib/trpc';
import { router } from './router';
import { applyTheme } from './lib/theme';
import { Titlebar } from './components/titlebar';

export function App() {
  const { i18n } = useTranslation();
  const prefs = trpc.app.prefs.get.useQuery();

  // Sync persisted preferences into runtime <html> class + i18n state.
  useEffect(() => {
    if (!prefs.data) return;
    applyTheme(prefs.data.theme);
    if (i18n.language !== prefs.data.language) {
      void i18n.changeLanguage(prefs.data.language);
    }
  }, [prefs.data, i18n]);

  // Listen for system theme changes (only meaningful for theme="system").
  useEffect(() => {
    if (prefs.data?.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [prefs.data?.theme]);

  return (
    <TooltipProvider delayDuration={200}>
      {/**
       * Custom titlebar sits above the router so it persists across
       * route changes and during route transitions / error states.
       * Routes render in the flex-1 region below.
       */}
      <div className="flex h-screen flex-col overflow-hidden">
        <Titlebar />
        <div className="relative min-h-0 flex-1">
          <RouterProvider router={router} />
        </div>
      </div>
    </TooltipProvider>
  );
}
