import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, CardContent, Input, Label, Progress } from '@snowluma/ui';
import { Download, RotateCcw } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { useWizardNavigate } from './wizard-shell';

export function CoreDownloadStep() {
  const { t } = useTranslation();
  const { next, back } = useWizardNavigate();
  const utils = trpc.useUtils();
  const versions = trpc.core.versions.list.useQuery();
  const switchVersion = trpc.core.versions.switch.useMutation({
    onSuccess: () => void utils.core.versions.list.invalidate(),
  });
  const download = trpc.core.versions.download.useMutation({
    onSuccess: () => {
      void utils.core.versions.list.invalidate();
    },
  });

  const [version, setVersion] = useState('1.8.1');
  const [file, setFile] = useState('snowluma-core-{version}-win32-x64.zip');

  const installed = versions.data?.installed ?? [];
  const active = versions.data?.active ?? null;

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">{t('wizard.coreDownload.title')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('wizard.coreDownload.subtitle')}</p>
      </header>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="version">{t('wizard.coreDownload.versionLabel')}</Label>
              <Input id="version" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.8.1" />
            </div>
            <div>
              <Label htmlFor="file">{t('wizard.coreDownload.fileLabel')}</Label>
              <Input id="file" value={file} onChange={(e) => setFile(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                const resolvedFile = file.replace(/\{version\}/g, version);
                download.mutate({ version: `v${version.replace(/^v/, '')}`, file: resolvedFile });
              }}
              disabled={download.isPending || !version || !file}
            >
              <Download className="size-4" />
              {download.isPending ? t('wizard.coreDownload.downloading') : t('wizard.coreDownload.download')}
            </Button>
            {download.error && (
              <span className="text-xs text-destructive">{download.error.message}</span>
            )}
          </div>
          {download.isPending && <Progress value={50} />}

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
