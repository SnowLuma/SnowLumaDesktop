import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { cn, ScrollArea } from '@snowluma/ui';
import { Bot, FileText, Settings, Download, Wrench, RefreshCw } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { ToastBridge } from './toast-bridge';

const NAV_ITEMS = [
  { to: '/app/bots', labelKey: 'main.nav.bots', icon: Bot },
  { to: '/app/logs', labelKey: 'main.nav.logs', icon: FileText },
  { to: '/app/settings', labelKey: 'main.nav.settings', icon: Settings },
  { to: '/app/update', labelKey: 'main.nav.update', icon: Download },
  { to: '/app/diagnostic', labelKey: 'main.nav.diagnostic', icon: Wrench },
] as const;

export function MainShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const appInfo = trpc.app.info.useQuery();
  const coreState = trpc.core.state.useQuery(undefined, { refetchInterval: 2_000 });

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="flex w-56 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
        <header className="border-b border-sidebar-border px-4 py-3">
          <div className="text-sm font-semibold">❄️ {t('app.name')}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">v{appInfo.data?.version ?? '?'}</div>
        </header>
        <nav className="flex-1 px-2 py-3">
          <ScrollArea className="h-full">
            <ul className="space-y-0.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = path.startsWith(item.to);
                return (
                  <li key={item.to}>
                    <button
                      type="button"
                      onClick={() => navigate({ to: item.to })}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition',
                        active
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'hover:bg-sidebar-accent/40',
                      )}
                    >
                      <Icon className="size-4" />
                      <span>{t(item.labelKey)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </nav>
        <footer className="border-t border-sidebar-border px-3 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className={cn('inline-block size-1.5 rounded-full', coreStatusColor(coreState.data?.status))} />
            <span>core: {coreState.data?.status ?? '...'}</span>
            {coreState.data?.activeVersion && (
              <span className="text-muted-foreground/70">· {coreState.data.activeVersion}</span>
            )}
          </div>
        </footer>
      </aside>
      <main className="flex flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
      <ToastBridge />
    </div>
  );
}

function coreStatusColor(status?: string): string {
  switch (status) {
    case 'running':
      return 'bg-success';
    case 'starting':
    case 'restarting':
      return 'bg-warning';
    case 'crashed':
      return 'bg-destructive';
    default:
      return 'bg-muted-foreground';
  }
}

void RefreshCw; // reserved for future inline refresh affordance
