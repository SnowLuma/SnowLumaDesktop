import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Progress,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@snowluma/ui';
import { Download, RotateCcw, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { useWizardNavigate } from './wizard-shell';
import { useDownloadProgress, formatBytes, formatSpeed } from '../../hooks/use-download-progress';
import { relativeTime } from '../../lib/format';

function pickWinAsset(assets: { name: string }[]): string | null {
  const explicit = assets.find((a) => /win[-_]?x?64.*\.zip$/i.test(a.name));
  if (explicit) return explicit.name;
  const looseZip = assets.find((a) => a.name.toLowerCase().endsWith('.zip'));
  return looseZip?.name ?? null;
}

export function CoreDownloadStep() {
  const { t } = useTranslation();
  const { next, back } = useWizardNavigate();
  const utils = trpc.useUtils();
  const versions = trpc.core.versions.list.useQuery();
  const remote = trpc.core.versions.remote.useQuery(undefined, { refetchOnWindowFocus: false });
  const switchVersion = trpc.core.versions.switch.useMutation({
    onSuccess: () => void utils.core.versions.list.invalidate(),
  });
  const download = trpc.core.versions.download.useMutation({
    onSuccess: () => {
      void utils.core.versions.list.invalidate();
    },
  });

  const [tag, setTag] = useState('');
  const [file, setFile] = useState('SnowLuma-v{version}-win-x64.zip');

  // Auto-select latest non-prerelease as soon as the list arrives.
  useEffect(() => {
    if (!remote.data || tag) return;
    const next = remote.data.latestTag ?? remote.data.releases[0]?.tag;
    if (next) setTag(next);
  }, [remote.data, tag]);

  // Update file template based on chosen release's win-x64 asset.
  useEffect(() => {
    if (!remote.data || !tag) return;
    const release = remote.data.releases.find((r) => r.tag === tag);
    if (!release) return;
    const auto = pickWinAsset(release.assets);
    if (auto) setFile(auto);
    else {
      const bare = tag.replace(/^v/, '');
      setFile(`SnowLuma-v${bare}-win-x64.zip`);
    }
  }, [tag, remote.data]);

  const installed = versions.data?.installed ?? [];
  const active = versions.data?.active ?? null;
  const progress = useDownloadProgress(
    tag ? `core:${tag}` : null,
    download.isPending || download.isSuccess,
  );
  const percent =
    progress.bytesTotal && progress.bytesTotal > 0
      ? Math.min(100, Math.round((progress.bytesDone / progress.bytesTotal) * 100))
      : null;

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">{t('wizard.coreDownload.title')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('wizard.coreDownload.subtitle')}</p>
      </header>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="version">选择版本</Label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => remote.refetch()}
                disabled={remote.isFetching}
                className="h-6 px-2 text-[11px]"
              >
                <RefreshCw className={cn('size-3', remote.isFetching && 'animate-spin')} />
                刷新
              </Button>
            </div>
            <Select value={tag} onValueChange={setTag} disabled={remote.isFetching || !remote.data?.releases.length}>
              <SelectTrigger id="version" className="font-mono">
                <SelectValue placeholder={remote.isFetching ? '正在获取版本列表…' : '选择一个版本'} />
              </SelectTrigger>
              <SelectContent>
                {remote.data?.releases.map((r) => (
                  <SelectItem key={r.tag} value={r.tag}>
                    <span className="font-mono">{r.tag}</span>
                    {r.tag === remote.data?.latestTag && (
                      <Badge variant="success" className="ml-2 px-1.5 py-0 text-[9px]">
                        latest
                      </Badge>
                    )}
                    {r.prerelease && (
                      <Badge variant="warning" className="ml-2 px-1.5 py-0 text-[9px]">
                        pre
                      </Badge>
                    )}
                    {r.publishedAt && (
                      <span className="ml-2 text-[10px] text-muted-foreground">
                        {relativeTime(r.publishedAt)}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {remote.error && (
              <p className="flex items-center gap-1.5 text-[11px] text-warning">
                <AlertTriangle className="size-3.5" />
                获取版本列表失败：{remote.error.message}
              </p>
            )}
            {remote.data && 'error' in remote.data && remote.data.error && (
              <p className="flex items-center gap-1.5 text-[11px] text-warning">
                <AlertTriangle className="size-3.5" />
                {remote.data.error}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="file">{t('wizard.coreDownload.fileLabel')}</Label>
            <Input id="file" value={file} onChange={(e) => setFile(e.target.value)} className="font-mono" />
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                if (!tag) return;
                download.mutate({ version: tag, file });
              }}
              disabled={download.isPending || !tag || !file}
            >
              <Download className="size-4" />
              {download.isPending ? t('wizard.coreDownload.downloading') : t('wizard.coreDownload.download')}
            </Button>
            {download.error && (
              <span className="text-xs text-destructive">{download.error.message}</span>
            )}
          </div>
          {download.isPending && (
            <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Loader2 className="size-4 animate-spin text-warning" />
                {t('wizard.coreDownload.downloading')}
                {progress.mirrorId && (
                  <span className="ml-auto text-[10px] font-normal text-muted-foreground">
                    {progress.mirrorId}
                    {progress.attempt > 1 && ` · #${progress.attempt}`}
                  </span>
                )}
              </div>
              <Progress value={percent ?? undefined} indeterminate={percent === null} />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-mono">
                  {formatBytes(progress.bytesDone)}
                  {progress.bytesTotal !== null && ` / ${formatBytes(progress.bytesTotal)}`}
                  {percent !== null && `  ·  ${percent}%`}
                </span>
                <span className="font-mono">{formatSpeed(progress.speedBytesPerSec) || '准备中…'}</span>
              </div>
            </div>
          )}

          <hr className="border-border" />

          <h3 className="text-sm font-medium">{t('wizard.coreDownload.installed')}</h3>
          {installed.length === 0 && (
            <p className="text-xs text-muted-foreground">{t('wizard.coreDownload.noneInstalled')}</p>
          )}
          <ul className="space-y-1">
            {installed.map((v) => (
              <li
                key={v}
                className="flex items-center justify-between rounded-md border border-border bg-card/50 px-3 py-2 text-sm"
              >
                <span>
                  {v}
                  {active === v && (
                    <span className="ml-2 text-[11px] text-primary">{t('wizard.coreDownload.active')}</span>
                  )}
                </span>
                {active !== v && (
                  <Button size="sm" variant="outline" onClick={() => switchVersion.mutate({ version: v })}>
                    <RotateCcw className="size-3.5" />
                    {t('wizard.coreDownload.activate')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => back('core-download')}>{t('wizard.back')}</Button>
        <Button onClick={() => next('core-download')} disabled={!active}>{t('wizard.next')}</Button>
      </div>
    </section>
  );
}
