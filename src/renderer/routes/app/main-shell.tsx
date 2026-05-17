import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  cn,
  ScrollArea,
  StatusDot,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@snowluma/ui';
import { Bot, FileText, Settings, Download, Wrench, Snowflake } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { ToastBridge } from './toast-bridge';
import { ThemeToggle } from '../../components/theme-toggle';
import { SidebarToggle } from '../../components/sidebar-toggle';
import { RouteTransition } from '../../components/route-transition';
import { navSidebarCollapsedAtom } from '../../state/atoms';
import { useCompactViewport } from '../../hooks/use-media-query';

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
  const [userCollapsed, setUserCollapsed] = useAtom(navSidebarCollapsedAtom);
  const compact = useCompactViewport(); // < md (768px) auto-collapse

  // At small widths force-collapse regardless of user preference; otherwise
  // honour the persisted toggle.
  const collapsed = compact || userCollapsed;

  // ⌘B / Ctrl+B toggle (only meaningful outside compact mode).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setUserCollapsed((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setUserCollapsed]);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside
        className={cn(
          'relative flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out',
          collapsed ? 'w-14' : 'w-56',
        )}
      >
        <header
          className={cn(
            'flex h-chrome shrink-0 items-center gap-2 border-b border-sidebar-border px-3',
            collapsed && 'justify-center px-2',
          )}
        >
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Snowflake className="size-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold leading-none">SnowLuma</div>
              <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                v{appInfo.data?.version ?? '?'}
              </div>
            </div>
          )}
          {!collapsed && !compact && <SidebarToggle collapsed={false} onToggle={() => setUserCollapsed(true)} />}
        </header>

        <nav className="flex-1 overflow-hidden p-2">
          <ScrollArea className="h-full">
            <ul className="space-y-0.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = path.startsWith(item.to);
                const button = (
                  <button
                    type="button"
                    onClick={() => navigate({ to: item.to })}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md text-left text-sm font-medium transition-colors',
                      collapsed ? 'h-9 justify-center px-0' : 'h-9 px-2.5',
                      active
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-xs'
                        : 'text-muted-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-foreground',
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                  </button>
                );
                return (
                  <li key={item.to}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{button}</TooltipTrigger>
                        <TooltipContent side="right">{t(item.labelKey)}</TooltipContent>
                      </Tooltip>
                    ) : (
                      button
                    )}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </nav>

        <footer
          className={cn(
            'flex h-chrome shrink-0 items-center gap-2 border-t border-sidebar-border px-3',
            collapsed && 'justify-center px-2',
          )}
        >
          {collapsed && !compact ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <SidebarToggle collapsed onToggle={() => setUserCollapsed(false)} />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right">展开侧栏</TooltipContent>
            </Tooltip>
          ) : compact ? null : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                    <StatusDot tone={coreStatusTone(coreState.data?.status)} pulse={coreState.data?.status === 'running'} />
                    <span className="truncate">core · {coreStatusLabel(coreState.data?.status)}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <div className="space-y-1">
                    <div>
                      状态：<span className="font-mono">{coreState.data?.status ?? '...'}</span>
                    </div>
                    {coreState.data?.activeVersion && (
                      <div>
                        版本：<span className="font-mono">{coreState.data.activeVersion}</span>
                      </div>
                    )}
                    {coreState.data?.webuiPort && (
                      <div>
                        webui：<span className="font-mono">127.0.0.1:{coreState.data.webuiPort}</span>
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
              <div className="ml-auto">
                <ThemeToggle compact />
              </div>
            </>
          )}
        </footer>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <RouteTransition>
          <Outlet />
        </RouteTransition>
      </main>
      <ToastBridge />
    </div>
  );
}

function coreStatusTone(status?: string): 'success' | 'warning' | 'destructive' | 'muted' {
  switch (status) {
    case 'running':
      return 'success';
    case 'starting':
    case 'restarting':
      return 'warning';
    case 'crashed':
      return 'destructive';
    default:
      return 'muted';
  }
}

function coreStatusLabel(status?: string): string {
  switch (status) {
    case 'stopped':
      return '已停止';
    case 'starting':
      return '启动中';
    case 'running':
      return '运行中';
    case 'crashed':
      return '已崩溃';
    case 'restarting':
      return '重启中';
    case 'no-version-active':
      return '未选定版本';
    default:
      return status ?? '加载中';
  }
}

/**
 * Reusable top-bar shared by every main view. Keeps height constant
 * (h-chrome → 52px) so the sidebar header/footer / view header all align.
 */
interface ViewHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  leading?: React.ReactNode;
  actions?: React.ReactNode;
}

export function ViewHeader({ title, subtitle, icon, leading, actions }: ViewHeaderProps) {
  return (
    <header className="flex h-chrome shrink-0 items-center gap-3 border-b border-border bg-card px-4">
      {leading}
      {icon && (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold leading-tight">{title}</div>
        {subtitle && (
          <div className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">{subtitle}</div>
        )}
      </div>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </header>
  );
}
