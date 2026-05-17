import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  CardContent,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ScrollArea,
  Separator,
} from '@snowluma/ui';
import { Download, RefreshCw, CheckCircle2, Sparkles, RotateCw } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { ViewHeader } from './main-shell';

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

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title={t('main.update.title')}
        icon={<Download className="size-4" />}
        actions={
          <Button size="sm" variant="ghost" onClick={() => check.refetch()} disabled={check.isFetching}>
            <RefreshCw className={`size-4 ${check.isFetching ? 'animate-spin' : ''}`} />
            {t('main.update.recheck')}
          </Button>
        }
      />
      <ScrollArea className="flex-1">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6 lg:p-8">
          {/* Current state card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div
                  className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${
                    available ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {available ? <Sparkles className="size-6" /> : <CheckCircle2 className="size-6" />}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <h2 className="text-base font-semibold tracking-tight">
                    {available ? '有新版本可用' : '已是最新版本'}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      {t('main.update.current')}：
                      <Badge variant="outline" className="ml-1">
                        {info?.currentVersion ?? '?'}
                      </Badge>
                    </span>
                    {available && (
                      <span className="flex items-center gap-1">
                        →
                        <Badge variant="success">{info?.latestVersion ?? '?'}</Badge>
                      </span>
                    )}
                  </div>
                  {info?.releaseDate && (
                    <p className="text-xs text-muted-foreground">发布于 {info.releaseDate}</p>
                  )}
                </div>
              </div>
              {available && (
                <div className="mt-5 flex flex-wrap gap-2">
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

          {/* Channel selector */}
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 space-y-0.5">
                  <h3 className="text-sm font-medium">{t('main.update.channelLabel')}</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">{t('main.update.channelHint')}</p>
                </div>
                <Select
                  value={channel.data ?? 'main'}
                  onValueChange={(v) => setChannel.mutate({ channel: v as 'main' | 'dev' })}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main">main · 稳定</SelectItem>
                    <SelectItem value="dev">dev · 每日预览</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Changelog */}
          {info?.releaseNotes && (
            <Card>
              <CardContent className="space-y-3 p-6">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">{t('main.update.changelog')}</h3>
                  <Badge variant="outline">{info.latestVersion}</Badge>
                </div>
                <Separator />
                <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {info.releaseNotes}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
