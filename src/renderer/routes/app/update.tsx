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
} from '@snowluma/ui';
import { Download, RefreshCw } from 'lucide-react';
import { trpc } from '../../lib/trpc';

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
    <div className="flex h-full flex-col p-6">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('main.update.title')}</h2>
        <Button size="sm" variant="ghost" onClick={() => check.refetch()}>
          <RefreshCw className="size-4" />
          {t('main.update.recheck')}
        </Button>
      </header>
      <Card className="max-w-xl">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">{t('main.update.channelLabel')}</div>
              <p className="text-xs text-muted-foreground">{t('main.update.channelHint')}</p>
            </div>
            <Select
              value={channel.data ?? 'main'}
              onValueChange={(v) => setChannel.mutate({ channel: v as 'main' | 'dev' })}
            >
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="main">main</SelectItem>
                <SelectItem value="dev">dev</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <hr className="border-border" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">{t('main.update.current')}</span>
              <Badge variant="secondary">{info?.currentVersion ?? '?'}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">{t('main.update.latest')}</span>
              <Badge variant={available ? 'success' : 'outline'}>
                {info?.latestVersion ?? '?'}
              </Badge>
            </div>
            {info?.releaseDate && (
              <div className="text-xs text-muted-foreground">{info.releaseDate}</div>
            )}
            {info?.releaseNotes && (
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-muted-foreground">{t('main.update.changelog')}</summary>
                <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-[11px] text-muted-foreground">{info.releaseNotes}</pre>
              </details>
            )}
          </div>
          {available && (
            <div className="flex gap-2">
              <Button onClick={() => download.mutate()} disabled={download.isPending}>
                <Download className="size-4" />
                {download.isPending ? t('main.update.downloading') : t('main.update.download')}
              </Button>
              <Button variant="outline" onClick={() => install.mutate()}>
                {t('main.update.restartInstall')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
