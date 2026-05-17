import { useTranslation } from 'react-i18next';
import { Button, Card, CardContent, ScrollArea } from '@snowluma/ui';
import { Wrench, FileDown, AlertCircle, CheckCircle2 } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { ViewHeader } from './main-shell';

export function DiagnosticView() {
  const { t } = useTranslation();
  const exportZip = trpc.diagnostic.export.useMutation();

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title={t('main.diagnostic.title')} icon={<Wrench className="size-4" />} />
      <ScrollArea className="flex-1">
        <div className="mx-auto w-full max-w-2xl p-6 lg:p-8">
          <Card>
            <CardContent className="space-y-5 p-6">
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <Wrench className="size-6" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-base font-semibold tracking-tight">{t('main.diagnostic.title')}</h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {t('main.diagnostic.subtitle')}
                  </p>
                </div>
              </div>
              <Button onClick={() => exportZip.mutate()} disabled={exportZip.isPending} className="w-full">
                <FileDown className="size-4" />
                {exportZip.isPending ? t('main.diagnostic.exporting') : t('main.diagnostic.export')}
              </Button>
              {exportZip.data && (
                <p className="flex items-start gap-2 break-all rounded-lg border border-success/30 bg-success/5 p-3 text-xs text-success-foreground">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  <span className="text-foreground">{t('main.diagnostic.exported', { path: exportZip.data })}</span>
                </p>
              )}
              {exportZip.error && (
                <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {exportZip.error.message}
                </p>
              )}
              <p className="text-xs leading-relaxed text-muted-foreground">{t('main.diagnostic.privacyNote')}</p>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
