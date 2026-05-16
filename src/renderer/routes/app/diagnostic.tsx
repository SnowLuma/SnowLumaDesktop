import { useTranslation } from 'react-i18next';
import { Button, Card, CardContent } from '@snowluma/ui';
import { Wrench, FileDown, AlertCircle } from 'lucide-react';
import { trpc } from '../../lib/trpc';

export function DiagnosticView() {
  const { t } = useTranslation();
  const exportZip = trpc.diagnostic.export.useMutation();

  return (
    <div className="flex h-full flex-col items-center justify-center p-8">
      <Card className="max-w-lg">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <Wrench className="size-6 text-primary" />
            <div>
              <h2 className="text-base font-semibold">{t('main.diagnostic.title')}</h2>
              <p className="text-sm text-muted-foreground">{t('main.diagnostic.subtitle')}</p>
            </div>
          </div>
          <Button
            onClick={() => exportZip.mutate()}
            disabled={exportZip.isPending}
            className="w-full"
          >
            <FileDown className="size-4" />
            {exportZip.isPending ? t('main.diagnostic.exporting') : t('main.diagnostic.export')}
          </Button>
          {exportZip.data && (
            <p className="break-all rounded-md border border-success/30 bg-success/5 p-3 text-xs">
              {t('main.diagnostic.exported', { path: exportZip.data })}
            </p>
          )}
          {exportZip.error && (
            <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 size-4" />
              {exportZip.error.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{t('main.diagnostic.privacyNote')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
