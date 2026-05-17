import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  CardContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Separator,
  ScrollArea,
  Badge,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  EmptyState,
  cn,
} from '@snowluma/ui';
import {
  Plus,
  Trash2,
  Pencil,
  Settings as SettingsIcon,
  Cpu,
  Globe,
  Star,
  Power,
  PowerOff,
  Download,
  GripVertical,
  RotateCw,
  Inbox,
} from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { ViewHeader } from './main-shell';
import { MirrorDialog } from '../../components/mirror-dialog';
import { CoreDownloadDialog } from '../../components/core-download-dialog';
import { ConfirmDialog } from '../../components/confirm-dialog';
import type { MirrorEntry } from '../../../main/store/schema';

export function SettingsView() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col">
      <ViewHeader title={t('main.settings.title')} icon={<SettingsIcon className="size-4" />} />
      <Tabs defaultValue="general" className="flex flex-1 min-h-0 flex-col">
        <div className="border-b border-border bg-card/40 px-4 py-2">
          <TabsList>
            <TabsTrigger value="general" className="gap-1.5">
              <SettingsIcon className="size-3.5" />
              {t('main.settings.tabs.general')}
            </TabsTrigger>
            <TabsTrigger value="core" className="gap-1.5">
              <Cpu className="size-3.5" />
              {t('main.settings.tabs.core')}
            </TabsTrigger>
            <TabsTrigger value="mirrors" className="gap-1.5">
              <Globe className="size-3.5" />
              {t('main.settings.tabs.mirrors')}
            </TabsTrigger>
          </TabsList>
        </div>
        <ScrollArea className="flex-1">
          <div className="mx-auto w-full max-w-3xl p-6">
            <TabsContent value="general">
              <GeneralSettings />
            </TabsContent>
            <TabsContent value="core">
              <CoreSettings />
            </TabsContent>
            <TabsContent value="mirrors">
              <MirrorSettings />
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

function GeneralSettings() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const prefs = trpc.app.prefs.get.useQuery();
  const setPrefs = trpc.app.prefs.set.useMutation({ onSuccess: () => utils.app.prefs.get.invalidate() });

  return (
    <Card>
      <CardContent className="p-6">
        <SettingsRow label={t('main.settings.themeLabel')} hint={t('main.settings.themeHint')}>
          <Select
            value={prefs.data?.theme ?? 'system'}
            onValueChange={(v) => setPrefs.mutate({ theme: v as 'light' | 'dark' | 'system' })}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">{t('main.settings.themeSystem')}</SelectItem>
              <SelectItem value="light">{t('main.settings.themeLight')}</SelectItem>
              <SelectItem value="dark">{t('main.settings.themeDark')}</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <Separator className="my-4" />
        <SettingsRow label={t('main.settings.languageLabel')}>
          <Select
            value={prefs.data?.language ?? 'zh-CN'}
            onValueChange={(v) => setPrefs.mutate({ language: v as 'zh-CN' | 'en-US' })}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="zh-CN">中文 (简体)</SelectItem>
              <SelectItem value="en-US">English</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <Separator className="my-4" />
        <SettingsRow label={t('main.settings.autostartLabel')} hint={t('main.settings.autostartHint')}>
          <Switch
            checked={prefs.data?.autostartEnabled ?? false}
            onCheckedChange={(v) => setPrefs.mutate({ autostartEnabled: v === true })}
          />
        </SettingsRow>
        <Separator className="my-4" />
        <SettingsRow label={t('main.settings.openMainOnLaunchLabel')} hint={t('main.settings.openMainOnLaunchHint')}>
          <Switch
            checked={prefs.data?.autostartOpenMainWindow ?? false}
            onCheckedChange={(v) => setPrefs.mutate({ autostartOpenMainWindow: v === true })}
            disabled={!prefs.data?.autostartEnabled}
          />
        </SettingsRow>
      </CardContent>
    </Card>
  );
}

function CoreSettings() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const versions = trpc.core.versions.list.useQuery();
  const coreState = trpc.core.state.useQuery(undefined, { refetchInterval: 2_000 });
  const sync = trpc.core.versions.sync.useMutation({ onSuccess: () => utils.core.versions.list.invalidate() });
  const activate = trpc.core.versions.switch.useMutation({ onSuccess: () => utils.core.versions.list.invalidate() });
  const remove = trpc.core.versions.delete.useMutation({ onSuccess: () => utils.core.versions.list.invalidate() });
  const restart = trpc.core.restart.useMutation();
  const stop = trpc.core.stop.useMutation();
  const start = trpc.core.start.useMutation();

  const [downloadOpen, setDownloadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const running = coreState.data?.status === 'running';
  const active = versions.data?.active ?? null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span>core 进程</span>
                <Badge variant={running ? 'success' : 'soft'} size="sm">
                  {coreState.data?.status ?? '加载中'}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {active ? (
                  <>
                    当前激活：<span className="font-mono text-foreground">{active}</span>
                    {coreState.data?.webuiPort && (
                      <> · webui 端口 <span className="font-mono text-foreground">{coreState.data.webuiPort}</span></>
                    )}
                  </>
                ) : (
                  <>尚未选定 core 版本，下载并激活以启动。</>
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {!running && (
                <Button size="sm" variant="outline" onClick={() => start.mutate()} disabled={!active}>
                  <Power className="size-4" />
                  启动
                </Button>
              )}
              {running && (
                <Button size="sm" variant="outline" onClick={() => stop.mutate()}>
                  <PowerOff className="size-4" />
                  停止
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => restart.mutate()} disabled={!active}>
                <RotateCw className="size-4" />
                重启
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium">{t('main.settings.coreVersions')}</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {t('main.settings.coreVersionsHint')}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon-sm" variant="ghost" onClick={() => sync.mutate()}>
                    <RotateCw className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">{t('main.settings.coreSync')}</TooltipContent>
              </Tooltip>
              <Button size="sm" onClick={() => setDownloadOpen(true)}>
                <Download className="size-4" />
                下载新版本
              </Button>
            </div>
          </div>
          {versions.data?.installed.length === 0 ? (
            <EmptyState
              icon={<Cpu className="size-5" />}
              title={t('main.settings.coreNone')}
              description="点击右上角“下载新版本”从镜像拉取 core。"
              action={
                <Button size="sm" onClick={() => setDownloadOpen(true)}>
                  <Download className="size-4" />
                  下载
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {versions.data?.installed.map((v) => {
                const isActive = active === v;
                return (
                  <li
                    key={v}
                    className={cn(
                      'group flex items-center gap-3 rounded-xl border bg-card p-3 transition-[border-color,box-shadow,transform] duration-150 ease-out',
                      isActive
                        ? 'border-primary/40 ring-1 ring-primary/30'
                        : 'border-border hover:border-border/60 hover:shadow-sm hover:-translate-y-px',
                    )}
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Cpu className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-mono font-medium">{v}</span>
                        {isActive && (
                          <Badge variant="success" size="sm">
                            <Star className="size-3 fill-current" />
                            {t('main.settings.coreActive')}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {!isActive && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="outline" onClick={() => activate.mutate({ version: v })}>
                              <Star className="size-3.5" />
                              {t('main.settings.coreActivate')}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">切到这个版本（会重启 core）</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => setDeleteTarget(v)}
                              disabled={isActive}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          {isActive ? '激活中不能删除，先切到别的版本' : '删除该版本'}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <CoreDownloadDialog open={downloadOpen} onClose={() => setDownloadOpen(false)} />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) remove.mutate({ version: deleteTarget });
        }}
        title={`删除 ${deleteTarget ?? ''}`}
        description="将从磁盘移除该 core 版本的二进制文件，数据 / 配置不受影响。"
        confirmLabel="删除"
        tone="destructive"
      />
    </div>
  );
}

function MirrorSettings() {
  const utils = trpc.useUtils();
  const list = trpc.mirrors.list.useQuery();
  const upsert = trpc.mirrors.upsert.useMutation({ onSuccess: () => utils.mirrors.list.invalidate() });
  const remove = trpc.mirrors.delete.useMutation({ onSuccess: () => utils.mirrors.list.invalidate() });

  const [dialogTarget, setDialogTarget] = useState<MirrorEntry | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<MirrorEntry | null>(null);

  const sorted = (list.data ?? []).slice().sort((a, b) => a.priority - b.priority);

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium">下载源</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              下载 core / 兼容 manifest 时按优先级顺序尝试。优先级越小越优先。
            </p>
          </div>
          <Button size="sm" onClick={() => setDialogTarget(null)}>
            <Plus className="size-4" />
            添加下载源
          </Button>
        </div>
        {sorted.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-5" />}
            title="尚未配置下载源"
            description="至少添加一个才能下载 core。"
          />
        ) : (
          <ul className="space-y-2">
            {sorted.map((m, idx) => (
              <li
                key={m.id}
                className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-[border-color,box-shadow,transform] duration-150 ease-out hover:border-border/60 hover:shadow-sm hover:-translate-y-px"
              >
                <GripVertical className="mt-1 size-4 shrink-0 text-muted-foreground/40" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className="truncate">{m.name}</span>
                    <Badge variant={idx === 0 ? 'success' : 'outline'} size="sm">
                      优先级 {m.priority}
                    </Badge>
                    {!m.enabled && (
                      <Badge variant="soft" size="sm">
                        已禁用
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                    {m.template}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Switch
                          checked={m.enabled}
                          onCheckedChange={(v) => upsert.mutate({ ...m, enabled: v === true })}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      {m.enabled ? '启用中（点击禁用）' : '已禁用（点击启用）'}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon-sm" variant="ghost" onClick={() => setDialogTarget(m)}>
                        <Pencil className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">编辑</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setDeleteTarget(m)}
                          disabled={m.id === 'github'}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      {m.id === 'github' ? '内置镜像不可删，可禁用' : '删除'}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <MirrorDialog
        open={dialogTarget !== undefined}
        mirror={dialogTarget ?? null}
        onClose={() => setDialogTarget(undefined)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) remove.mutate({ id: deleteTarget.id });
        }}
        title={`删除下载源「${deleteTarget?.name ?? ''}」`}
        description="将从配置中移除该下载源，已下载的 core 不受影响。"
        confirmLabel="删除"
        tone="destructive"
      />
    </Card>
  );
}

function SettingsRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {hint && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
