import { Button } from '@snowluma/ui';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useEffect, useState } from 'react';
import { trpc } from '../lib/trpc';
import { applyTheme } from '../lib/theme';

type Theme = 'light' | 'dark' | 'system';

const NEXT: Record<Theme, Theme> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const ICONS: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const LABELS: Record<Theme, string> = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统',
};

/**
 * Cycles through light → dark → system → light. Applies the new theme
 * to <html> SYNCHRONOUSLY (so the button feels responsive even when the
 * tRPC roundtrip is slow / in preview mode), and persists to electron-
 * store via `app.prefs.set` for future sessions.
 */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const utils = trpc.useUtils();
  const prefs = trpc.app.prefs.get.useQuery();
  const setPrefs = trpc.app.prefs.set.useMutation({
    onSuccess: () => utils.app.prefs.get.invalidate(),
  });

  // Mirror the persisted theme locally so we can react instantly on click,
  // independent of the mutation roundtrip.
  const [local, setLocal] = useState<Theme>(prefs.data?.theme ?? 'system');
  useEffect(() => {
    if (prefs.data?.theme && prefs.data.theme !== local) {
      setLocal(prefs.data.theme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.data?.theme]);

  const Icon = ICONS[local];

  function cycle() {
    const next = NEXT[local];
    setLocal(next);
    applyTheme(next);
    setPrefs.mutate({ theme: next });
  }

  return (
    <Button
      variant="ghost"
      size={compact ? 'icon-sm' : 'sm'}
      onClick={cycle}
      aria-label={`切换主题，当前：${LABELS[local]}`}
      title={`主题：${LABELS[local]}（点击切换）`}
      className={compact ? '' : 'gap-1.5'}
    >
      <Icon className="size-4" />
      {!compact && <span className="text-xs">{LABELS[local]}</span>}
    </Button>
  );
}
