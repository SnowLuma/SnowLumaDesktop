import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Separator,
  Badge,
  Switch,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@snowluma/ui';
import { Download, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { useDownloadProgress, formatBytes, formatSpeed } from '../hooks/use-download-progress';
import { relativeTime } from '../lib/format';

interface CoreDownloadDialogProps {
  open: boolean;
  onClose: () => void;
}

const FALLBACK_FILE_TEMPLATE = 'SnowLuma-v{version}-win-x64.zip';

// Pick the Windows zip artifact out of a release's asset list. The
// canonical name is `SnowLuma-v<version>-win-x64.zip` but we match
// case-insensitively and tolerate small future variations.
function pickWinAsset(assets: { name: string }[]): string | null {
  const explicit = assets.find((a) => /win[-_]?x?64.*\.zip$/i.test(a.name));
  if (explicit) return explicit.name;
  const looseZip = assets.find((a) => a.name.toLowerCase().endsWith('.zip'));
  return looseZip?.name ?? null;
}

/**
 * Download + (optionally) activate a core version.
 *
 * The version field is a dropdown populated from the SnowLuma GitHub
 * releases list (newest first, latest non-prerelease selected by
 * default). The file template is auto-derived from the chosen
 * release's win-x64 asset but stays user-editable for edge cases.
 */
export function CoreDownloadDialog({ open, onClose }: CoreDownloadDialogProps) {
  const utils = trpc.useUtils();
  const versions = trpc.core.versions.list.useQuery();
  const remote = trpc.core.versions.remote.useQuery(undefined, {
    enabled: open,
    refetchOnWindowFocus: false,
  });
  const download = trpc.core.versions.download.useMutation();
  const switchVersion = trpc.core.versions.switch.useMutation();

  const [tag, setTag] = useState('');
  const [file, setFile] = useState(FALLBACK_FILE_TEMPLATE);
  const [activateAfter, setActivateAfter] = useState(true);

  // Default the dropdown to the latest non-prerelease as soon as the
  // remote list resolves. We only set it on first arrival so manual
  // selections aren't stomped by a background refetch.
  useEffect(() => {
    if (!remote.data || tag) return;
    const fallback = remote.data.releases[0]?.tag;
    const next = remote.data.latestTag ?? fallback;
    if (next) setTag(next);
  }, [remote.data, tag]);

  // When the user picks a version, auto-populate the file field from
  // the matching release's win-x64 asset. They can still override.
  useEffect(() => {
    if (!remote.data || !tag) return;
    const release = remote.data.releases.find((r) => r.tag === tag);
    if (!release) return;
    const auto = pickWinAsset(release.assets);
    if (auto) {
      setFile(auto);
    } else {
      // No asset on this release — fall back to the conventional name
      // pattern with the bare version interpolated.
      const bare = tag.replace(/^v/, '');
      setFile(`SnowLuma-v${bare}-win-x64.zip`);
    }
  }, [tag, remote.data]);

  const alreadyInstalled = !!tag && versions.data?.installed.includes(tag);
  const selectedRelease = useMemo(
    () => remote.data?.releases.find((r) => r.tag === tag),
    [remote.data, tag],
  );
  // Subscribe to push events for this exact core version so we get
  // real-time progress without polling — see `useDownloadProgress`.
  const progress = useDownloadProgress(tag ? `core:${tag}` : null, download.isPending || download.isSuccess);

  function handleDownload() {
    if (!tag || !file) return;
    download.mutate(
      { version: tag, file },
      {
        onSuccess: async () => {
          await utils.core.versions.list.invalidate();
          if (activateAfter) {
            switchVersion.mutate({ version: tag });
          }
        },
      },
    );
  }

  function handleClose() {
    if (!download.isPending) onClose();
  }

  const percent =
    progress.bytesTotal && progress.bytesTotal > 0
      ? Math.min(100, Math.round((progress.bytesDone / progress.bytesTotal) * 100))
      : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Download className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle>下载 core 版本</DialogTitle>
              <DialogDescription className="mt-1">
                从 GitHub 拉取并解压到本地，按已启用的下载源顺序回退。
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Separator />

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="core-version">选择版本</Label>
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
              <SelectTrigger id="core-version" className="font-mono">
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
            {alreadyInstalled && (
              <p className="flex items-center gap-1.5 text-[11px] text-warning">
                <AlertTriangle className="size-3.5" />
                {tag} 已安装，下载会覆盖。
              </p>
            )}
            {selectedRelease?.name && (
              <p className="text-[10px] text-muted-foreground">{selectedRelease.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="core-file">文件名</Label>
            <Input
              id="core-file"
              value={file}
              onChange={(e) => setFile(e.target.value)}
              className="font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              已根据所选版本自动填好。若 release 中文件名不同，可手动修改。
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <div className="min-w-0">
              <Label className="text-foreground">下载后立即激活</Label>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                关闭则只下载，不切换当前运行的 core。
              </p>
            </div>
            <Switch checked={activateAfter} onCheckedChange={(v) => setActivateAfter(v === true)} />
          </div>

          {download.isPending && (
            <DownloadProgressBlock percent={percent} progress={progress} />
          )}
          {download.isSuccess && !download.isPending && (
            <PhaseRow tone="success" icon={<CheckCircle2 className="size-4" />} title="下载完成" body={`已写入到本地版本目录 · ${tag}`} />
          )}
          {download.error && (
            <PhaseRow tone="destructive" icon={<AlertTriangle className="size-4" />} title="下载失败" body={download.error.message} />
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={download.isPending}>
            {download.isSuccess ? '完成' : '取消'}
          </Button>
          {!download.isSuccess && (
            <Button onClick={handleDownload} disabled={!tag || !file || download.isPending}>
              <Download className="size-4" />
              开始下载
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DownloadProgressBlock({
  percent,
  progress,
}: {
  percent: number | null;
  progress: ReturnType<typeof useDownloadProgress>;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
      <div className="flex items-center gap-2 font-medium text-foreground">
        <Loader2 className="size-4 animate-spin text-warning" />
        正在下载…
        {progress.mirrorId && (
          <span className="ml-auto text-[10px] font-normal text-muted-foreground">
            来源：{progress.mirrorId}
            {progress.attempt > 1 && ` · 尝试 #${progress.attempt}`}
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
  );
}

function PhaseRow({ tone, icon, title, body }: { tone: 'success' | 'warning' | 'destructive'; icon: React.ReactNode; title: string; body: string }) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm',
        tone === 'success' && 'border-success/30 bg-success/5 text-success',
        tone === 'warning' && 'border-warning/30 bg-warning/5 text-warning',
        tone === 'destructive' && 'border-destructive/30 bg-destructive/5 text-destructive',
      )}
    >
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-foreground">{title}</div>
        <div className="mt-0.5 break-all text-xs leading-relaxed text-muted-foreground">{body}</div>
      </div>
    </div>
  );
}
