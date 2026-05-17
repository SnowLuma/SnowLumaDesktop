import { useNavigate } from '@tanstack/react-router';
import { Button, Card, CardContent } from '@snowluma/ui';
import { AlertOctagon, RotateCw, Home, ClipboardCopy } from 'lucide-react';
import { useState } from 'react';

interface AppErrorProps {
  error: Error;
  reset?: () => void;
}

/**
 * Friendly catch-all error UI rendered by the router's `errorComponent` and
 * top-level <ErrorBoundary>. Shows the message, gives the user a way out
 * (reload, home, copy details for issue reports).
 */
export function AppError({ error, reset }: AppErrorProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const details = [
    `Message: ${error.message}`,
    error.stack ? `\nStack:\n${error.stack}` : '',
  ].join('');

  return (
    <div className="flex h-screen items-center justify-center bg-background p-8">
      <Card className="w-full max-w-lg shadow-lg">
        <CardContent className="space-y-5 p-8">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
              <AlertOctagon className="size-5" />
            </div>
            <div className="space-y-1">
              <h1 className="text-base font-semibold text-foreground">出错了</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                SnowLuma Desktop 渲染出现异常。可以尝试刷新；如果反复发生，请用下方按钮复制错误信息提交 issue。
              </p>
            </div>
          </div>
          <pre className="max-h-48 overflow-auto rounded-lg border border-border bg-muted px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
            {error.message}
          </pre>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                reset?.();
                if (!reset) window.location.reload();
              }}
            >
              <RotateCw className="size-4" />
              重试
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate({ to: '/app/bots' })}>
              <Home className="size-4" />
              回主界面
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(details);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  /* clipboard might be blocked */
                }
              }}
            >
              <ClipboardCopy className="size-4" />
              {copied ? '已复制' : '复制错误'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
