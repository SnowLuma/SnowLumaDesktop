import { Minus, Square, X, Copy, Snowflake } from 'lucide-react';
import { cn } from '@snowluma/ui';
import { useWindowState } from '../hooks/use-window-state';

/**
 * Custom Windows-style titlebar for the frameless BrowserWindow. The
 * whole bar is a drag region; the buttons opt back out via
 * `app-region-no-drag` so clicks register. Commands route through
 * `window.snowlumaIpc.window.send(...)` → preload → main, where the
 * actual BrowserWindow methods run.
 *
 * Close button hides to tray (matches the OS-level close behavior in
 * src/main/index.ts). Tooltip on the close button replaces the old
 * "已最小化到后台" native dialog.
 */
export function Titlebar() {
  const { maximized, focused } = useWindowState();

  const send = (cmd: 'minimize' | 'toggle-maximize' | 'close') => {
    globalThis.window?.snowlumaIpc?.window?.send(cmd);
  };

  return (
    <div
      className={cn(
        'app-region-drag relative z-50 flex h-titlebar shrink-0 select-none items-center',
        'border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80',
        !focused && 'opacity-90',
      )}
    >
      {/* Brand cluster */}
      <div className="flex items-center gap-2 px-3 text-[12px]">
        <Snowflake className="size-3.5 text-primary" aria-hidden />
        <span className="font-medium tracking-tight text-foreground/90">
          SnowLumaDesktop
        </span>
      </div>

      {/* Flexible drag spacer */}
      <div className="flex-1" />

      {/* Window controls — always opt out of drag so clicks register. */}
      <div className="app-region-no-drag flex h-full items-stretch">
        <TitlebarButton
          aria-label="最小化"
          title="最小化"
          onClick={() => send('minimize')}
        >
          <Minus className="size-3.5" />
        </TitlebarButton>
        <TitlebarButton
          aria-label={maximized ? '还原' : '最大化'}
          title={maximized ? '还原' : '最大化'}
          onClick={() => send('toggle-maximize')}
        >
          {maximized ? (
            <Copy className="size-3 rotate-90" aria-hidden />
          ) : (
            <Square className="size-3" aria-hidden />
          )}
        </TitlebarButton>
        <TitlebarButton
          aria-label="关闭主窗口 (最小化到托盘)"
          title="关闭主窗口 — 仍在后台运行，右键托盘 → 退出 才会真正关闭"
          onClick={() => send('close')}
          variant="close"
        >
          <X className="size-3.5" />
        </TitlebarButton>
      </div>
    </div>
  );
}

interface TitlebarButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'close';
}

function TitlebarButton({
  className,
  variant = 'default',
  children,
  ...props
}: TitlebarButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-full w-11 items-center justify-center text-muted-foreground',
        'transition-colors duration-100',
        variant === 'default' && 'hover:bg-foreground/10 hover:text-foreground',
        variant === 'close' && 'hover:bg-destructive hover:text-destructive-foreground',
        'focus:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
