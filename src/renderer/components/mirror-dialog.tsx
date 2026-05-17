import { useEffect, useState } from 'react';
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
  Switch,
  Separator,
  cn,
} from '@snowluma/ui';
import { Globe } from 'lucide-react';
import { trpc } from '../lib/trpc';

interface MirrorEntry {
  id: string;
  name: string;
  template: string;
  priority: number;
  enabled: boolean;
}

interface MirrorDialogProps {
  open: boolean;
  onClose: () => void;
  /** Edit mode when an existing mirror is passed; add mode when null. */
  mirror?: MirrorEntry | null;
}

const MIN_PRIORITY = 0;
const MAX_PRIORITY = 999;
const DEFAULT_PRIORITY = 100;

/**
 * Add / edit a mirror.
 *
 * Priority semantics: 0 = highest, 999 = lowest. The download-manager
 * sorts ascending so a value of 0 is tried first.
 */
export function MirrorDialog({ open, onClose, mirror }: MirrorDialogProps) {
  const utils = trpc.useUtils();
  const upsert = trpc.mirrors.upsert.useMutation({
    onSuccess: () => {
      utils.mirrors.list.invalidate();
      onClose();
    },
  });

  const isEdit = !!mirror;
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('');
  const [priority, setPriority] = useState<number>(DEFAULT_PRIORITY);
  const [enabled, setEnabled] = useState(true);

  // Reset / hydrate on open
  useEffect(() => {
    if (!open) return;
    setName(mirror?.name ?? '');
    setTemplate(mirror?.template ?? '');
    setPriority(mirror?.priority ?? DEFAULT_PRIORITY);
    setEnabled(mirror?.enabled ?? true);
  }, [open, mirror]);

  const trimmedName = name.trim();
  const trimmedTemplate = template.trim();
  const templateError = trimmedTemplate && !/^https?:\/\//i.test(trimmedTemplate)
    ? '必须以 http(s):// 开头'
    : null;
  const valid =
    trimmedName.length > 0 &&
    trimmedTemplate.length > 0 &&
    templateError === null &&
    priority >= MIN_PRIORITY &&
    priority <= MAX_PRIORITY;

  function handleSave() {
    if (!valid) return;
    upsert.mutate({
      id: mirror?.id ?? `mirror-${Date.now()}`,
      name: trimmedName,
      template: trimmedTemplate,
      priority: Math.round(priority),
      enabled,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Globe className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle>{isEdit ? '编辑下载源' : '添加下载源'}</DialogTitle>
              <DialogDescription className="mt-1">
                设置下载 core 和其他资源时使用的镜像 URL。
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Separator />

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="mirror-name">名称</Label>
            <Input
              id="mirror-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='例如 "国内 CDN"'
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mirror-template">URL 模板</Label>
            <Input
              id="mirror-template"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder="https://your-mirror/{version}/{file}"
              aria-invalid={templateError !== null}
              className="font-mono"
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              支持占位符 <code className="rounded bg-muted px-1 py-px font-mono text-[10px]">{'{version}'}</code> 和{' '}
              <code className="rounded bg-muted px-1 py-px font-mono text-[10px]">{'{file}'}</code>。
            </p>
            {templateError && <p className="text-[11px] text-destructive">{templateError}</p>}
          </div>

          <PrioritySlider value={priority} onChange={setPriority} />

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <div className="min-w-0">
              <Label className="text-foreground">启用此源</Label>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                禁用后下载时将跳过此源；保留配置不删除。
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={(v) => setEnabled(v === true)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={!valid || upsert.isPending}>
            {isEdit ? '保存' : '添加'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PrioritySlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const clamped = Math.max(MIN_PRIORITY, Math.min(MAX_PRIORITY, value));
  const percent = ((clamped - MIN_PRIORITY) / (MAX_PRIORITY - MIN_PRIORITY)) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label htmlFor="mirror-priority">优先级</Label>
        <span className="text-[11px] text-muted-foreground">
          越小优先 · 0 = 最高，999 = 最低
        </span>
      </div>
      <div className="flex items-center gap-3">
        <input
          id="mirror-priority-range"
          type="range"
          min={MIN_PRIORITY}
          max={MAX_PRIORITY}
          step={1}
          value={clamped}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn(
            'h-2 flex-1 cursor-pointer appearance-none rounded-full outline-none',
            // Track gradient — primary up to current value, muted after
            'bg-[linear-gradient(to_right,var(--primary)_0%,var(--primary)_var(--p),var(--muted)_var(--p),var(--muted)_100%)]',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-card [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110',
          )}
          style={{ ['--p' as string]: `${percent}%` }}
        />
        <Input
          id="mirror-priority"
          type="number"
          min={MIN_PRIORITY}
          max={MAX_PRIORITY}
          value={clamped}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            onChange(Math.max(MIN_PRIORITY, Math.min(MAX_PRIORITY, Math.round(n))));
          }}
          className="w-20 text-center"
        />
      </div>
    </div>
  );
}
