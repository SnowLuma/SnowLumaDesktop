import { useState } from 'react';
import { useAtom } from 'jotai';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Checkbox,
  ScrollArea,
  Avatar,
  AvatarFallback,
  Separator,
  StatusDot,
  EmptyState,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  Badge,
  cn,
} from '@snowluma/ui';
import {
  Plus,
  Pencil,
  Trash2,
  Play,
  Pause,
  RotateCw,
  Inbox,
  Bot as BotIcon,
  Filter,
  PanelRightClose,
  PanelRightOpen,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  CircleDashed,
  Hand,
} from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { trashEntriesAtom, botSidebarCollapsedAtom } from '../../state/atoms';
import type { BotRecord } from '@shared/types';
import { ViewHeader } from './main-shell';

const UNDO_WINDOW_MS = 5_000;

type BotStatus =
  | 'offline'
  | 'launching-qq'
  | 'awaiting-login'
  | 'online'
  | 'reconnecting'
  | 'needs-attention'
  | 'user-managed';

export function BotsView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { uin: routeUin } = (useParams({ strict: false }) as { uin?: string }) ?? {};
  const bots = trpc.bot.list.useQuery();
  const states = trpc.bot.states.useQuery(undefined, { refetchInterval: 2_000 });
  const utils = trpc.useUtils();
  const webuiUrl = trpc.core.webuiUrl.useQuery(
    { botUin: routeUin },
    { refetchInterval: 5_000 },
  );

  const startBot = trpc.bot.start.useMutation();
  const stopBot = trpc.bot.stop.useMutation();

  const [renameTarget, setRenameTarget] = useState<BotRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BotRecord | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useAtom(botSidebarCollapsedAtom);
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');

  const selectedRecord = bots.data?.find((b) => b.uin === routeUin) ?? bots.data?.[0];
  const filtered = bots.data?.filter((b) => {
    if (filter === 'all') return true;
    const state = states.data?.find((s) => s.uin === b.uin);
    return filter === 'online' ? state?.status === 'online' : state?.status !== 'online';
  });

  return (
    <div className="flex h-full min-h-0 flex-1">
      <aside
        className={cn(
          'flex shrink-0 flex-col border-r border-border bg-sidebar/30 transition-[width] duration-200 ease-out',
          sidebarCollapsed ? 'w-0 -ml-px' : 'w-64',
        )}
        aria-hidden={sidebarCollapsed}
      >
        {!sidebarCollapsed && (
          <>
            <ViewHeader
              title={t('main.bots.title')}
              icon={<BotIcon className="size-4" />}
              actions={
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => {
                          const next: typeof filter = filter === 'all' ? 'online' : filter === 'online' ? 'offline' : 'all';
                          setFilter(next);
                        }}
                      >
                        <Filter className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      过滤：{filter === 'all' ? '全部' : filter === 'online' ? '仅在线' : '仅离线'}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => navigate({ to: '/wizard/add-bot' })}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">添加 Bot</TooltipContent>
                  </Tooltip>
                </>
              }
            />
            <ScrollArea className="flex-1">
              <ul className="space-y-0.5 p-2">
                {filtered?.length === 0 && (
                  <EmptyState
                    className="my-4"
                    icon={<Inbox className="size-5" />}
                    title={filter === 'all' ? t('main.bots.empty') : '无匹配 Bot'}
                  />
                )}
                {filtered?.map((bot) => {
                  const state = states.data?.find((s) => s.uin === bot.uin);
                  const selected = selectedRecord?.uin === bot.uin;
                  return (
                    <li key={bot.uin}>
                      <button
                        type="button"
                        onClick={() => navigate({ to: '/app/bots/$uin', params: { uin: bot.uin } })}
                        className={cn(
                          'group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors',
                          selected
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                            : 'hover:bg-sidebar-accent/40',
                        )}
                      >
                        <Avatar size={32}>
                          <AvatarFallback>{(bot.customName || bot.uin).slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{bot.customName || bot.uin}</div>
                          <div className="truncate text-[10px] text-muted-foreground">
                            UIN {bot.uin}
                          </div>
                        </div>
                        <StatusDot tone={botStatusTone(state?.status)} pulse={state?.status === 'online'} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
            <ImportOrphans />
          </>
        )}
      </aside>

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {selectedRecord ? (
          <>
            <ViewHeader
              title={selectedRecord.customName || selectedRecord.uin}
              subtitle={
                <span className="flex items-center gap-2">
                  <span>UIN {selectedRecord.uin}</span>
                  <span className="text-muted-foreground/50">·</span>
                  <BotStatusBadge status={states.data?.find((s) => s.uin === selectedRecord.uin)?.status} />
                </span>
              }
              leading={
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => setSidebarCollapsed((v) => !v)}
                      aria-label="切换 Bot 列表"
                    >
                      {sidebarCollapsed ? (
                        <PanelRightOpen className="size-4" />
                      ) : (
                        <PanelRightClose className="size-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {sidebarCollapsed ? '展开 Bot 列表' : '收起 Bot 列表'}
                  </TooltipContent>
                </Tooltip>
              }
              icon={
                <Avatar size={28}>
                  <AvatarFallback>{(selectedRecord.customName || selectedRecord.uin).slice(0, 2)}</AvatarFallback>
                </Avatar>
              }
              actions={
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon-sm" variant="ghost" onClick={() => startBot.mutate({ uin: selectedRecord.uin })}>
                        <Play className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">启动</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon-sm" variant="ghost" onClick={() => stopBot.mutate({ uin: selectedRecord.uin })}>
                        <Pause className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">暂停</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon-sm" variant="ghost" onClick={() => webuiUrl.refetch()}>
                        <RotateCw className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">刷新 webui</TooltipContent>
                  </Tooltip>
                  <Separator orientation="vertical" className="mx-1 h-5" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon-sm" variant="ghost" onClick={() => setRenameTarget(selectedRecord)}>
                        <Pencil className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">重命名</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon-sm" variant="ghost" onClick={() => setDeleteTarget(selectedRecord)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">删除</TooltipContent>
                  </Tooltip>
                </>
              }
            />
            <div className="relative flex flex-1 min-h-0">
              {webuiUrl.data?.url ? (
                <iframe
                  title="webui"
                  src={webuiUrl.data.url}
                  className="absolute inset-0 size-full border-0"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                />
              ) : (
                <div className="m-auto p-8">
                  <EmptyState
                    icon={<Loader2 className={cn('size-5', webuiUrl.isFetching && 'animate-spin')} />}
                    title={webuiUrl.isFetching ? t('main.bots.loadingWebui') : t('main.bots.webuiUnavailable')}
                    description={webuiUrl.isFetching ? undefined : '请稍后再刷新，或检查 core 是否在运行。'}
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <ViewHeader
              title={t('main.bots.title')}
              icon={<BotIcon className="size-4" />}
              leading={
                sidebarCollapsed ? (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setSidebarCollapsed(false)}
                    aria-label="展开 Bot 列表"
                  >
                    <PanelRightOpen className="size-4" />
                  </Button>
                ) : undefined
              }
            />
            <div className="flex flex-1 items-center justify-center px-8">
              <Card className="w-full max-w-md">
                <CardContent className="space-y-4 p-6 text-center">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <Inbox className="size-6" />
                  </div>
                  <h2 className="text-base font-semibold">{t('main.bots.banner')}</h2>
                  <p className="text-sm text-muted-foreground">{t('main.bots.bannerHint')}</p>
                  <Button onClick={() => navigate({ to: '/wizard/add-bot' })}>
                    <Plus className="size-4" />
                    {t('main.bots.addBot')}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </section>

      {renameTarget && (
        <RenameDialog
          bot={renameTarget}
          onClose={() => setRenameTarget(null)}
          onRenamed={() => {
            utils.bot.list.invalidate();
            setRenameTarget(null);
          }}
        />
      )}
      {deleteTarget && (
        <DeleteDialog bot={deleteTarget} onClose={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}

function botStatusTone(status?: BotStatus | string): 'success' | 'warning' | 'destructive' | 'muted' | 'info' {
  switch (status) {
    case 'online':
      return 'success';
    case 'awaiting-login':
    case 'launching-qq':
    case 'reconnecting':
      return 'warning';
    case 'needs-attention':
      return 'destructive';
    case 'user-managed':
      return 'info';
    default:
      return 'muted';
  }
}

function BotStatusBadge({ status }: { status?: BotStatus | string }) {
  const map: Record<string, { tone: 'success' | 'warning' | 'destructive' | 'soft' | 'info'; icon: typeof CheckCircle2; label: string }> = {
    online: { tone: 'success', icon: CheckCircle2, label: '在线' },
    'awaiting-login': { tone: 'warning', icon: Loader2, label: '等待登录' },
    'launching-qq': { tone: 'warning', icon: Loader2, label: '启动 QQ 中' },
    reconnecting: { tone: 'warning', icon: Loader2, label: '重连中' },
    'needs-attention': { tone: 'destructive', icon: AlertTriangle, label: '需要处理' },
    'user-managed': { tone: 'info', icon: Hand, label: '用户托管' },
    offline: { tone: 'soft', icon: CircleDashed, label: '离线' },
  };
  const entry = map[status ?? 'offline'] ?? map.offline!;
  const Icon = entry.icon;
  return (
    <Badge variant={entry.tone}>
      <Icon className={cn('size-3', (status === 'awaiting-login' || status === 'launching-qq' || status === 'reconnecting') && 'animate-spin')} />
      {entry.label}
    </Badge>
  );
}

function RenameDialog({ bot, onClose, onRenamed }: { bot: BotRecord; onClose: () => void; onRenamed: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(bot.customName);
  const rename = trpc.bot.rename.useMutation({ onSuccess: onRenamed });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('main.bots.rename')}</DialogTitle>
          <DialogDescription>{t('main.bots.renameHint')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="rename-name">{t('main.bots.nameLabel')}</Label>
          <Input
            id="rename-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => rename.mutate({ uin: bot.uin, customName: name })}>{t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ bot, onClose }: { bot: BotRecord; onClose: () => void }) {
  const { t } = useTranslation();
  const [confirmName, setConfirmName] = useState('');
  const [withData, setWithData] = useState(false);
  const [withConfig, setWithConfig] = useState(false);
  const stage = trpc.bot.delete.stage.useMutation();
  const [, setEntries] = useAtom(trashEntriesAtom);
  const utils = trpc.useUtils();

  const displayName = bot.customName || bot.uin;
  const confirmed = confirmName.trim() === displayName;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('main.bots.deleteTitle', { name: displayName })}</DialogTitle>
          <DialogDescription>{t('main.bots.deleteHint')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor="confirm-name">{t('main.bots.confirmNameLabel')}</Label>
          <Input
            id="confirm-name"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={displayName}
            autoFocus
          />
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <Checkbox id="with-data" checked={withData} onCheckedChange={(v) => setWithData(v === true)} />
            <Label htmlFor="with-data" className="cursor-pointer text-sm text-foreground">
              {t('main.bots.deleteWithData')}
            </Label>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <Checkbox id="with-config" checked={withConfig} onCheckedChange={(v) => setWithConfig(v === true)} />
            <Label htmlFor="with-config" className="cursor-pointer text-sm text-foreground">
              {t('main.bots.deleteWithConfig')}
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            disabled={!confirmed || stage.isPending}
            onClick={() =>
              stage.mutate(
                { uin: bot.uin, withData, withConfig },
                {
                  onSuccess: (res) => {
                    setEntries((cur) => [
                      ...cur,
                      {
                        uin: bot.uin,
                        trashEntry: res.trashEntry,
                        record: bot,
                        expiresAt: Date.now() + UNDO_WINDOW_MS,
                      },
                    ]);
                    utils.bot.list.invalidate();
                    onClose();
                  },
                },
              )
            }
          >
            {t('main.bots.deleteConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportOrphans() {
  const { t } = useTranslation();
  const orphans = trpc.bot.import.findOrphans.useQuery();
  if (!orphans.data || orphans.data.length === 0) return null;
  return (
    <div className="border-t border-sidebar-border bg-warning/5 px-3 py-2 text-xs">
      <div className="flex items-center gap-1.5 text-warning">
        <AlertTriangle className="size-3.5" />
        {t('main.bots.orphansFound', { count: orphans.data.length })}
      </div>
    </div>
  );
}
