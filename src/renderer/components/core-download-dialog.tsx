import { useState } from 'react';
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
  cn,
} from '@snowluma/ui';
import { Download, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { trpc } from '../lib/trpc';

interface CoreDownloadDialogProps {
  open: boolean;
  onClose: () => void;
}

const DEFAULT_FILE_TEMPLATE = 'snowluma-core-{version}-win32-x64.zip';

/**
 * Download + (optionally) activate a core version. Replaces the
 * "inline version + file inputs" we had in the wizard.
 */
export function CoreDownloadDialog({ open, onClose }: CoreDownloadDialogProps) {
  const utils = trpc.useUtils();
  const versions = trpc.core.versions.list.useQuery();
  const download = trpc.core.versions.download.useMutation();
  const switchVersion = trpc.core.versions.switch.useMutation();

  const [version, setVersion] = useState('');
  const [file, setFile] = useState(DEFAULT_FILE_TEMPLATE);
  const [activateAfter, setActivateAfter] = useState(true);

  const trimmedVersion = version.trim().replace(/^v/, '');
  const valid = trimmedVersion.length > 0 && /^\d+\.\d+\.\d+/.test(trimmedVersion);
  const alreadyInstalled = !!trimmedVersion && versions.data?.installed.includes(`v${trimmedVersion}`);

  function handleDownload() {
    if (!valid) return;
    const tag = `v${trimmedVersion}`;
    const resolvedFile = file.replace(/\{version\}/g, trimmedVersion);
    download.mutate(
      { version: tag, file: resolvedFile },
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
                从已启用的下载源拉取并解压到本地。
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Separator />

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="core-version">版本号</Label>
            <Input
              id="core-version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.8.1"
              autoFocus
              className="font-mono"
            />
            {alreadyInstalled && (
              <p className="flex items-center gap-1.5 text-[11px] text-warning">
                <AlertTriangle className="size-3.5" />
                v{trimmedVersion} 已安装，下载会覆盖。
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="core-file">文件名模板</Label>
            <Input
              id="core-file"
              value={file}
              onChange={(e) => setFile(e.target.value)}
              className="font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              <code className="rounded bg-muted px-1 py-px font-mono text-[10px]">{'{version}'}</code> 会被替换成版本号。
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
            <PhaseRow tone="warning" icon={<Loader2 className="size-4 animate-spin" />} title="下载中…" body="正在从下载源拉取并校验 SHA256。" />
          )}
          {download.isSuccess && !download.isPending && (
            <PhaseRow tone="success" icon={<CheckCircle2 className="size-4" />} title="下载完成" body={`已写入到本地版本目录 · v${trimmedVersion}`} />
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
            <Button onClick={handleDownload} disabled={!valid || download.isPending}>
              <Download className="size-4" />
              开始下载
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

void Badge;
