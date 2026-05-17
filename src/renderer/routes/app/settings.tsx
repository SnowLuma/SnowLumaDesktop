import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
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
  cn,
} from '@snowluma/ui';
import { Plus, Trash2, Settings as SettingsIcon, Cpu, Globe, Star } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { ViewHeader } from './main-shell';

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
  const sync = trpc.core.versions.sync.useMutation({ onSuccess: () => utils.core.versions.list.invalidate() });
  const activate = trpc.core.versions.switch.useMutation({ onSuccess: () => utils.core.versions.list.invalidate() });
  const remove = trpc.core.versions.delete.useMutation({ onSuccess: () => utils.core.versions.list.invalidate() });
  const restart = trpc.core.restart.useMutation();

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium">{t('main.settings.coreVersions')}</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t('main.settings.coreVersionsHint')}</p>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => sync.mutate()}>
              {t('main.settings.coreSync')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => restart.mutate()}>
              {t('main.settings.coreRestart')}
            </Button>
          </div>
        </div>
        <ul className="space-y-1.5">
          {versions.data?.installed.length === 0 && (
            <li className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
              {t('main.settings.coreNone')}
            </li>
          )}
          {versions.data?.installed.map((v) => {
            const isActive = versions.data?.active === v;
            return (
              <li
                key={v}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 transition-[border-color,box-shadow,transform] duration-150 ease-out',
                  isActive
                    ? 'border-primary/40 ring-1 ring-primary/30'
                    : 'border-border hover:border-border/60 hover:shadow-sm',
                )}
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-mono">{v}</span>
                  {isActive && (
                    <Badge variant="success" size="sm">
                      <Star className="size-3 fill-current" />
                      {t('main.settings.coreActive')}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  {!isActive && (
                    <Button size="sm" variant="outline" onClick={() => activate.mutate({ version: v })}>
                      {t('main.settings.coreActivate')}
                    </Button>
                  )}
                  {!isActive && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon-sm" variant="ghost" onClick={() => remove.mutate({ version: v })}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">删除该版本</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function MirrorSettings() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const list = trpc.mirrors.list.useQuery();
  const upsert = trpc.mirrors.upsert.useMutation({ onSuccess: () => utils.mirrors.list.invalidate() });
  const remove = trpc.mirrors.delete.useMutation({ onSuccess: () => utils.mirrors.list.invalidate() });

  const [name, setName] = useState('');
  const [template, setTemplate] = useState('');

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <ul className="space-y-2">
          {list.data?.map((m) => (
            <li
              key={m.id}
              className="rounded-xl border border-border bg-card p-4 transition-[border-color,box-shadow,transform] duration-150 ease-out hover:border-border/60 hover:shadow-sm hover:-translate-y-px"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">{m.name}</span>
                    <Badge variant="outline" size="sm">prio {m.priority}</Badge>
                  </div>
                  <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{m.template}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch
                    checked={m.enabled}
                    onCheckedChange={(v) => upsert.mutate({ ...m, enabled: v === true })}
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => remove.mutate({ id: m.id })}
                        disabled={m.id === 'github'}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      {m.id === 'github' ? '内置镜像不可删' : '删除'}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <Separator />
        <div className="space-y-2 rounded-xl border border-dashed border-border p-4">
          <Label>{t('main.settings.mirrorAdd')}</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_2fr]">
            <Input
              placeholder={t('main.settings.mirrorName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder="https://your-mirror/{version}/{file}"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            onClick={() => {
              if (!name || !template) return;
              upsert.mutate({
                id: `mirror-${Date.now()}`,
                name,
                template,
                priority: 50,
                enabled: true,
              });
              setName('');
              setTemplate('');
            }}
          >
            <Plus className="size-4" />
            {t('main.settings.mirrorAddBtn')}
          </Button>
        </div>
      </CardContent>
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
