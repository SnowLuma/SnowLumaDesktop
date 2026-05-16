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
  cn,
} from '@snowluma/ui';
import { Plus, Pencil, Trash2, Play, Pause, RotateCw, Inbox, Search } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { trashEntriesAtom } from '../../state/atoms';
import type { BotRecord } from '@shared/types';

const UNDO_WINDOW_MS = 5_000;

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

  const selectedRecord = bots.data?.find((b) => b.uin === routeUin) ?? bots.data?.[0];

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="flex w-64 flex-col border-r border-border bg-sidebar/40">
        <header className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-medium">{t('main.bots.title')}</span>
          <Button size="icon-sm" variant="ghost" onClick={() => navigate({ to: '/app/bots' })}>
            <Plus className="size-4" />
          </Button>
        </header>
        <ScrollArea className="flex-1">
          <ul className="space-y-0.5 p-2">
            {bots.data?.map((bot) => {
              const state = states.data?.find((s) => s.uin === bot.uin);
              const selected = selectedRecord?.uin === bot.uin;
              return (
                <li key={bot.uin}>
                  <button
                    type="button"
                    onClick={() => navigate({ to: '/app/bots/$uin', params: { uin: bot.uin } })}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition',
                      selected
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'hover:bg-sidebar-accent/40',
                    )}
                  >
                    <Avatar size={28}>
                      <AvatarFallback>{(bot.customName || bot.uin).slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{bot.customName || bot.uin}</div>
                      <div className="truncate text-[10px] text-muted-foreground">{bot.uin}</div>
                    </div>
                    <span className={cn('size-2 rounded-full', botStatusColor(state?.status))} />
                  </button>
                </li>
              );
            })}
            {bots.data?.length === 0 && (
              <div className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                {t('main.bots.empty')}
              </div>
            )}
          </ul>
        </ScrollArea>
        <ImportOrphans />
      </aside>
      <section className="flex flex-1 flex-col overflow-hidden">
        {selectedRecord ? (
          <>
            <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
              <div className="flex items-center gap-3">
                <Avatar size={32}>
                  <AvatarFallback>{(selectedRecord.customName || selectedRecord.uin).slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm font-medium">{selectedRecord.customName || selectedRecord.uin}</div>
                  <div className="text-[11px] text-muted-foreground">UIN {selectedRecord.uin}</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => startBot.mutate({ uin: selectedRecord.uin })}>
                  <Play className="size-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => stopBot.mutate({ uin: selectedRecord.uin })}>
                  <Pause className="size-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => webuiUrl.refetch()}>
                  <RotateCw className="size-4" />
                </Button>
                <Separator orientation="vertical" className="mx-2 h-6" />
                <Button size="sm" variant="ghost" onClick={() => setRenameTarget(selectedRecord)}>
                  <Pencil className="size-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(selectedRecord)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </header>
            <div className="flex flex-1 overflow-hidden">
              {webuiUrl.data?.url ? (
                <iframe
                  title="webui"
                  src={webuiUrl.data.url}
                  className="flex-1 border-0"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                />
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  {webuiUrl.isFetching ? t('main.bots.loadingWebui') : t('main.bots.webuiUnavailable')}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center px-8">
            <Card className="max-w-md">
              <CardContent className="space-y-4 p-6 text-center">
                <Inbox className="mx-auto size-8 text-muted-foreground" />
                <h2 className="text-base font-semibold">{t('main.bots.banner')}</h2>
                <p className="text-sm text-muted-foreground">{t('main.bots.bannerHint')}</p>
                <Button onClick={() => navigate({ to: '/wizard/add-bot' })}>
                  <Plus className="size-4" />
                  {t('main.bots.addBot')}
                </Button>
              </CardContent>
            </Card>
          </div>
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
        <DeleteDialog
          bot={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function botStatusColor(status?: string): string {
  switch (status) {
    case 'online':
      return 'bg-success';
    case 'awaiting-login':
    case 'launching-qq':
    case 'reconnecting':
      return 'bg-warning';
    case 'needs-attention':
      return 'bg-destructive';
    default:
      return 'bg-muted-foreground/40';
  }
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
        <Label htmlFor="rename-name">{t('main.bots.nameLabel')}</Label>
        <Input id="rename-name" value={name} onChange={(e) => setName(e.target.value)} />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={() => rename.mutate({ uin: bot.uin, customName: name })}>
            {t('common.save')}
          </Button>
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
          <Input id="confirm-name" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={displayName} />
          <div className="flex items-center gap-2">
            <Checkbox id="with-data" checked={withData} onCheckedChange={(v) => setWithData(v === true)} />
            <Label htmlFor="with-data">{t('main.bots.deleteWithData')}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="with-config" checked={withConfig} onCheckedChange={(v) => setWithConfig(v === true)} />
            <Label htmlFor="with-config">{t('main.bots.deleteWithConfig')}</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
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
    <div className="border-t border-border bg-card/30 px-3 py-2 text-xs">
      <div className="flex items-center gap-1 text-muted-foreground">
        <Search className="size-3" />
        {t('main.bots.orphansFound', { count: orphans.data.length })}
      </div>
    </div>
  );
}
