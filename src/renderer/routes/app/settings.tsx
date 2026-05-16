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
  TabsContent,
  TabsList,
  TabsTrigger,
  Separator,
} from '@snowluma/ui';
import { Plus, Trash2 } from 'lucide-react';
import { trpc } from '../../lib/trpc';

export function SettingsView() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <header className="mb-4">
        <h2 className="text-lg font-semibold">{t('main.settings.title')}</h2>
      </header>
      <Tabs defaultValue="general" className="flex h-full flex-col">
        <TabsList>
          <TabsTrigger value="general">{t('main.settings.tabs.general')}</TabsTrigger>
          <TabsTrigger value="core">{t('main.settings.tabs.core')}</TabsTrigger>
          <TabsTrigger value="mirrors">{t('main.settings.tabs.mirrors')}</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="flex-1 overflow-auto">
          <GeneralSettings />
        </TabsContent>
        <TabsContent value="core" className="flex-1 overflow-auto">
          <CoreSettings />
        </TabsContent>
        <TabsContent value="mirrors" className="flex-1 overflow-auto">
          <MirrorSettings />
        </TabsContent>
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
    <div className="space-y-4 py-4">
      <Card><CardContent className="space-y-4 p-5">
        <Row label={t('main.settings.themeLabel')} hint={t('main.settings.themeHint')}>
          <Select
            value={prefs.data?.theme ?? 'system'}
            onValueChange={(v) => setPrefs.mutate({ theme: v as 'light' | 'dark' | 'system' })}
          >
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="system">{t('main.settings.themeSystem')}</SelectItem>
              <SelectItem value="light">{t('main.settings.themeLight')}</SelectItem>
              <SelectItem value="dark">{t('main.settings.themeDark')}</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Separator />
        <Row label={t('main.settings.languageLabel')}>
          <Select
            value={prefs.data?.language ?? 'zh-CN'}
            onValueChange={(v) => setPrefs.mutate({ language: v as 'zh-CN' | 'en-US' })}
          >
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="zh-CN">中文 (简体)</SelectItem>
              <SelectItem value="en-US">English</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Separator />
        <Row label={t('main.settings.autostartLabel')} hint={t('main.settings.autostartHint')}>
          <Switch
            checked={prefs.data?.autostartEnabled ?? false}
            onCheckedChange={(v) => setPrefs.mutate({ autostartEnabled: v === true })}
          />
        </Row>
        <Row label={t('main.settings.openMainOnLaunchLabel')} hint={t('main.settings.openMainOnLaunchHint')}>
          <Switch
            checked={prefs.data?.autostartOpenMainWindow ?? false}
            onCheckedChange={(v) => setPrefs.mutate({ autostartOpenMainWindow: v === true })}
            disabled={!prefs.data?.autostartEnabled}
          />
        </Row>
      </CardContent></Card>
    </div>
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
    <div className="space-y-4 py-4">
      <Card><CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">{t('main.settings.coreVersions')}</div>
            <p className="text-xs text-muted-foreground">{t('main.settings.coreVersionsHint')}</p>
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
        <ul className="space-y-1">
          {versions.data?.installed.length === 0 && (
            <li className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
              {t('main.settings.coreNone')}
            </li>
          )}
          {versions.data?.installed.map((v) => {
            const isActive = versions.data?.active === v;
            return (
              <li key={v} className="flex items-center justify-between rounded-md border border-border bg-card/50 px-3 py-2 text-sm">
                <span>{v}{isActive && <span className="ml-2 text-[11px] text-primary">{t('main.settings.coreActive')}</span>}</span>
                <div className="flex gap-1">
                  {!isActive && (
                    <Button size="sm" variant="ghost" onClick={() => activate.mutate({ version: v })}>
                      {t('main.settings.coreActivate')}
                    </Button>
                  )}
                  {!isActive && (
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate({ version: v })}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent></Card>
    </div>
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
    <div className="space-y-4 py-4">
      <Card><CardContent className="space-y-4 p-5">
        <ul className="space-y-2">
          {list.data?.map((m) => (
            <li key={m.id} className="rounded-md border border-border bg-card/50 p-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="font-medium">{m.name}</div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={m.enabled}
                    onCheckedChange={(v) => upsert.mutate({ ...m, enabled: v === true })}
                  />
                  <Button size="icon-sm" variant="ghost" onClick={() => remove.mutate({ id: m.id })} disabled={m.id === 'github'}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-1 break-all text-xs text-muted-foreground">{m.template}</div>
              <div className="mt-1 text-[10px] text-muted-foreground">prio {m.priority}</div>
            </li>
          ))}
        </ul>
        <Separator />
        <div className="space-y-2">
          <Label>{t('main.settings.mirrorAdd')}</Label>
          <Input placeholder={t('main.settings.mirrorName')} value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="https://your-mirror/{version}/{file}" value={template} onChange={(e) => setTemplate(e.target.value)} />
          <Button
            size="sm"
            onClick={() => {
              if (!name || !template) return;
              upsert.mutate({ id: `mirror-${Date.now()}`, name, template, priority: 50, enabled: true });
              setName('');
              setTemplate('');
            }}
          >
            <Plus className="size-4" />
            {t('main.settings.mirrorAddBtn')}
          </Button>
        </div>
      </CardContent></Card>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <Label>{label}</Label>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}
