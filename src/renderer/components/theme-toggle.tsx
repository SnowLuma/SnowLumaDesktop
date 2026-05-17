import { Button } from '@snowluma/ui';
import { Moon, Sun, Monitor } from 'lucide-react';
import { trpc } from '../lib/trpc';

const NEXT: Record<'light' | 'dark' | 'system', 'light' | 'dark' | 'system'> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const ICONS: Record<'light' | 'dark' | 'system', typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const LABELS: Record<'light' | 'dark' | 'system', string> = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统',
};

/**
 * Cycles through light → dark → system → light. Persists to electron-store
 * via `app.prefs.set` so the choice survives reloads.
 */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const utils = trpc.useUtils();
  const prefs = trpc.app.prefs.get.useQuery();
  const setPrefs = trpc.app.prefs.set.useMutation({
    onSuccess: () => utils.app.prefs.get.invalidate(),
  });

  const current = prefs.data?.theme ?? 'system';
  const Icon = ICONS[current];

  return (
    <Button
      variant="ghost"
      size={compact ? 'icon-sm' : 'sm'}
      onClick={() => setPrefs.mutate({ theme: NEXT[current] })}
      aria-label={`切换主题，当前：${LABELS[current]}`}
      title={`主题：${LABELS[current]}（点击切换）`}
      className={compact ? '' : 'gap-1.5'}
    >
      <Icon className="size-4" />
      {!compact && <span className="text-xs">{LABELS[current]}</span>}
    </Button>
  );
}
