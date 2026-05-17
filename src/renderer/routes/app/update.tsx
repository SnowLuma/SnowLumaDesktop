import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  CardContent,
  Badge,
  ScrollArea,
  cn,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@snowluma/ui';
import {
  Download,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  RotateCw,
  Clock,
  GitBranch,
  Package,
  ArrowRight,
} from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { ViewHeader } from './main-shell';
import { relativeTime } from '../../lib/format';

export function UpdateView() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const channel = trpc.updater.channel.useQuery();
  const check = trpc.updater.check.useQuery(undefined, { refetchOnWindowFocus: false });
  const setChannel = trpc.updater.setChannel.useMutation({
    onSuccess: () => {
      utils.updater.channel.invalidate();
      utils.updater.check.invalidate();
    },
  });
  const download = trpc.updater.download.useMutation();
  const install = trpc.updater.quitAndInstall.useMutation();

  const info = check.data;
  const available = info?.available ?? false;
  const ch = channel.data ?? 'main';

  // dataUpdatedAt is when React Query last refreshed — close enough to
  // "last checked" without us tracking it explicitly.
  const lastChecked = useMemo(() => {
    if (!check.dataUpdatedAt) return null;
    return new Date(check.dataUpdatedAt).toISOString();
  }, [check.dataUpdatedAt]);

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title={t('main.update.title')}
        icon={<Download className="size-4" />}
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" onClick={() => check.refetch()} disabled={check.isFetching}>
                <RefreshCw className={cn('size-4', check.isFetching && 'animate-spin')} />
                {t('main.update.recheck')}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {lastChecked ? `上次检查：${relativeTime(lastChecked)}` : '尚未检查'}
            </TooltipContent>
          </Tooltip>
        }
      />
      <ScrollArea className="flex-1">
        <div className="mx-auto w-full max-w-3xl space-y-4 p-6 lg:p-8">
          {/* Hero status card */}
          <Card
            className={cn(
              available && 'border-primary/40 ring-1 ring-primary/20',
              !available && info && 'border-success/30 ring-1 ring-success/10',
            )}
          >
            <CardContent className="space-y-5 p-6">
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    'flex size-14 shrink-0 items-center justify-center rounded-2xl shadow-sm transition-colors',
                    available ? 'bg-primary/15 text-primary' : 'bg-success/15 text-success',
                  )}
                >
                  {available ? <Sparkles className="size-7" /> : <CheckCircle2 className="size-7" />}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <h2 className="text-lg font-semibold tracking-tight">
                    {available ? '有新版本可用' : info ? '已是最新版本' : '检查更新中…'}
                  </h2>
                  {available && info && (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="outline" className="font-mono">
                        {info.currentVersion}
                      </Badge>
                      <ArrowRight className="size-4 text-muted-foreground" />
                      <Badge variant="success" className="font-mono">
                        {info.latestVersion}
                      </Badge>
                    </div>
                  )}
                  {!available && info && (
                    <p className="text-sm text-muted-foreground">
                      当前版本：<span className="font-mono text-foreground">{info.currentVersion}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-3">
                <Stat icon={<Package className="size-3.5" />} label="当前版本" value={info?.currentVersion ?? '?'} />
                <Stat icon={<GitBranch className="size-3.5" />} label="更新通道" value={ch === 'main' ? 'main · 稳定' : 'dev · 预览'} />
                <Stat
                  icon={<Clock className="size-3.5" />}
                  label="上次检查"
                  value={lastChecked ? relativeTime(lastChecked) : '尚未检查'}
                />
              </div>

              {available && (
                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button onClick={() => download.mutate()} disabled={download.isPending}>
                    <Download className="size-4" />
                    {download.isPending ? t('main.update.downloading') : t('main.update.download')}
                  </Button>
                  <Button variant="outline" onClick={() => install.mutate()}>
                    <RotateCw className="size-4" />
                    {t('main.update.restartInstall')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Channel switcher — segmented control */}
          <Card>
            <CardContent className="space-y-3 p-6">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium">{t('main.update.channelLabel')}</h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {t('main.update.channelHint')}
                  </p>
                </div>
              </div>
              <SegmentedControl
                value={ch}
                onChange={(v) => setChannel.mutate({ channel: v as 'main' | 'dev' })}
                options={[
                  { value: 'main', label: 'main', description: '稳定发布' },
                  { value: 'dev', label: 'dev', description: 'nightly 预览' },
                ]}
              />
            </CardContent>
          </Card>

          {/* Changelog */}
          {info?.releaseNotes && (
            <Card>
              <CardContent className="space-y-3 p-6">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">{t('main.update.changelog')}</h3>
                  {info.latestVersion && (
                    <Badge variant="outline" className="font-mono">
                      {info.latestVersion}
                    </Badge>
                  )}
                </div>
                <Changelog markdown={info.releaseNotes} />
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="truncate text-sm font-medium text-foreground" title={value}>
        {value}
      </div>
    </div>
  );
}

interface SegOption {
  value: string;
  label: string;
  description?: string;
}

function SegmentedControl({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SegOption[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/30 p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left transition-all',
              active
                ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/40',
            )}
          >
            <span className="text-sm font-medium">{opt.label}</span>
            {opt.description && (
              <span className="text-[10px] text-muted-foreground">{opt.description}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Renders a release-notes blob as a bullet list when it looks like
 * markdown bullets; otherwise as a preformatted block.
 */
function Changelog({ markdown }: { markdown: string }) {
  const lines = markdown.split('\n').map((l) => l.trim());
  const bullets = lines.filter((l) => /^[-*•]\s+/.test(l));
  const looksLikeBullets = bullets.length >= lines.filter(Boolean).length / 2;

  if (looksLikeBullets && bullets.length > 0) {
    return (
      <ul className="space-y-1.5 text-sm text-foreground/90">
        {bullets.map((l, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden />
            <span className="leading-relaxed">{l.replace(/^[-*•]\s+/, '')}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <pre className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
      {markdown}
    </pre>
  );
}
