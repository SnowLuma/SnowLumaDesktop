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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Badge,
  Separator,
  cn,
} from '@snowluma/ui';
import { Play, CheckCircle2, Loader2, Bot, AlertTriangle } from 'lucide-react';
import { trpc } from '../lib/trpc';

interface AddBotDialogProps {
  open: boolean;
  onClose: () => void;
  onAdded?: (uin: string) => void;
}

type Phase = 'config' | 'launching' | 'awaiting-login' | 'success' | 'error';

/**
 * Reusable Add Bot dialog. Lives outside the first-run wizard so users
 * can add a Bot from the main UI without bouncing back to onboarding.
 * Mirrors the wizard's add-bot fields but in a controlled modal flow.
 */
export function AddBotDialog({ open, onClose, onAdded }: AddBotDialogProps) {
  const qq = trpc.qq.cached.useQuery();
  const utils = trpc.useUtils();
  const upsert = trpc.bot.upsert.useMutation();
  const startBot = trpc.bot.start.useMutation();
  const states = trpc.bot.states.useQuery(undefined, {
    refetchInterval: open ? 1_500 : false,
  });

  const [customName, setCustomName] = useState('');
  const [launchMode, setLaunchMode] = useState<'desktop' | 'user'>('desktop');
  const [hideQq, setHideQq] = useState(true);
  const [pendingUin, setPendingUin] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('config');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset every time the dialog re-opens
  useEffect(() => {
    if (!open) {
      setCustomName('');
      setLaunchMode('desktop');
      setHideQq(true);
      setPendingUin(null);
      setPhase('config');
      setErrorMsg(null);
    }
  }, [open]);

  // Watch for any Bot in the live states list flipping to online
  useEffect(() => {
    if (phase !== 'launching' && phase !== 'awaiting-login') return;
    const newlyOnline = states.data?.find((s) => s.status === 'online' && s.uin !== pendingUin);
    if (newlyOnline) {
      setPhase('success');
      utils.bot.list.invalidate();
      onAdded?.(newlyOnline.uin);
    }
  }, [states.data, phase, pendingUin, onAdded, utils.bot.list]);

  function handleLaunch() {
    if (!qq.data) {
      setPhase('error');
      setErrorMsg('未检测到 QQ 安装。请先到设置里指定 QQ.exe 路径。');
      return;
    }
    const tempUin = `pending-${Date.now()}`;
    setPendingUin(tempUin);
    setPhase('launching');
    setErrorMsg(null);
    upsert.mutate(
      {
        uin: tempUin,
        customName,
        qqPath: qq.data.path,
        launchMode,
        hideQqWindowAfterLogin: hideQq,
        createdAt: Date.now(),
      },
      {
        onSuccess: () => {
          startBot.mutate(
            { uin: tempUin },
            {
              onSuccess: () => setPhase('awaiting-login'),
              onError: (err) => {
                setPhase('error');
                setErrorMsg(err.message);
              },
            },
          );
        },
        onError: (err) => {
          setPhase('error');
          setErrorMsg(err.message);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Bot className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle>添加 Bot</DialogTitle>
              <DialogDescription className="mt-1">
                配置完成后会启动 QQ，等你扫码登录后自动注入。
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Separator />

        {phase === 'config' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bot-name-dialog">Bot 名字（可选）</Label>
              <Input
                id="bot-name-dialog"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder='比如 "我的主号"'
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="launch-mode-dialog">启动方式</Label>
              <Select value={launchMode} onValueChange={(v) => setLaunchMode(v as 'desktop' | 'user')}>
                <SelectTrigger id="launch-mode-dialog">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desktop">Desktop 接管 QQ 生命周期</SelectItem>
                  <SelectItem value="user">我自己启动 QQ</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {launchMode === 'desktop'
                  ? 'Desktop 会启动、监控、重启 QQ。Desktop 退出时也会停 QQ。'
                  : '你自己启动 QQ；Desktop 只检测并注入。'}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <div className="min-w-0">
                <Label className="text-foreground">登录后隐藏 QQ 主界面</Label>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  避免 QQ 聊天列表被当作普通 QQ 用。
                </p>
              </div>
              <Switch checked={hideQq} onCheckedChange={(v) => setHideQq(v === true)} />
            </div>

            {qq.data ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card/40 px-3 py-2 text-xs">
                <CheckCircle2 className="size-3.5 text-success" />
                <span className="truncate text-muted-foreground">
                  检测到 QQ <Badge variant="outline" size="sm">{qq.data.version ?? '?'}</Badge>{' '}
                  <span className="break-all font-mono">{qq.data.path}</span>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                <AlertTriangle className="size-3.5" />
                未检测到 QQ。请先在设置里指定 QQ.exe 路径。
              </div>
            )}
          </div>
        )}

        {(phase === 'launching' || phase === 'awaiting-login') && (
          <PhaseRow
            tone="warning"
            icon={<Loader2 className="size-4 animate-spin" />}
            title={phase === 'launching' ? '启动 QQ 中…' : '等待登录…'}
            body={phase === 'launching' ? '请稍候。' : 'QQ 窗口已弹出，请扫码或输入密码完成登录。'}
          />
        )}

        {phase === 'success' && (
          <PhaseRow
            tone="success"
            icon={<CheckCircle2 className="size-4" />}
            title="Bot 已上线"
            body="可以关闭这个对话框，回到主界面继续配置。"
          />
        )}

        {phase === 'error' && (
          <PhaseRow
            tone="destructive"
            icon={<AlertTriangle className="size-4" />}
            title="启动失败"
            body={errorMsg ?? '未知错误'}
          />
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {phase === 'success' ? '完成' : '取消'}
          </Button>
          {phase === 'config' && (
            <Button onClick={handleLaunch} disabled={!qq.data || upsert.isPending}>
              <Play className="size-4" />
              启动
            </Button>
          )}
          {phase === 'error' && (
            <Button onClick={() => setPhase('config')}>重试</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PhaseRow({
  tone,
  icon,
  title,
  body,
}: {
  tone: 'success' | 'warning' | 'destructive';
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm',
        tone === 'success' && 'border-success/30 bg-success/5 text-success',
        tone === 'warning' && 'border-warning/30 bg-warning/5 text-warning',
        tone === 'destructive' && 'border-destructive/30 bg-destructive/5 text-destructive',
      )}
    >
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-foreground">{title}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{body}</div>
      </div>
    </div>
  );
}
