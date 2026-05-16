import { useTranslation } from 'react-i18next';
import { Button, Card, CardContent, Badge } from '@snowluma/ui';
import { Search, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { useWizardNavigate } from './wizard-shell';

export function QqDetectStep() {
  const { t } = useTranslation();
  const { next, back } = useWizardNavigate();
  const detect = trpc.qq.detect.useQuery(undefined, { refetchOnWindowFocus: false });
  const evaluate = trpc.qq.compat.evaluate.useQuery(
    { version: detect.data?.version ?? '' },
    { enabled: !!detect.data?.version },
  );

  const install = detect.data;
  const verdict = evaluate.data;

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">{t('wizard.qqDetect.title')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('wizard.qqDetect.subtitle')}</p>
      </header>
      <Card>
        <CardContent className="space-y-4 p-6">
          {detect.isFetching && <p className="text-sm text-muted-foreground">{t('wizard.qqDetect.searching')}</p>}
          {!detect.isFetching && !install && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <div className="flex items-center gap-2 font-medium text-destructive">
                <AlertTriangle className="size-4" />
                {t('wizard.qqDetect.notFound')}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t('wizard.qqDetect.notFoundHint')}</p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open('https://im.qq.com/pcqq/index.shtml')}
                >
                  <ExternalLink className="size-4" />
                  {t('wizard.qqDetect.openOfficial')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => detect.refetch()}>
                  <Search className="size-4" />
                  {t('wizard.qqDetect.rescan')}
                </Button>
              </div>
            </div>
          )}
          {install && (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="size-5 text-success" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{t('wizard.qqDetect.found')}</div>
                  <div className="mt-1 break-all text-xs text-muted-foreground">{install.path}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t('wizard.qqDetect.versionLabel')}{' '}
                    <span className="font-mono">{install.version ?? '?'}</span>
                  </div>
                </div>
              </div>
              {verdict && (
                <CompatVerdictBanner kind={verdict.kind} />
              )}
              <Button size="sm" variant="ghost" onClick={() => detect.refetch()}>
                <Search className="size-4" />
                {t('wizard.qqDetect.rescan')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => back('qq-detect')}>{t('wizard.back')}</Button>
        <Button onClick={() => next('qq-detect')} disabled={!install}>
          {t('wizard.next')}
        </Button>
      </div>
    </section>
  );
}

function CompatVerdictBanner({ kind }: { kind: string }) {
  const { t } = useTranslation();
  const variant = kind === 'good' ? 'success' : kind === 'unknown' ? 'warning' : 'destructive';
  const message =
    kind === 'good'
      ? t('wizard.qqDetect.compatGood')
      : kind === 'unknown'
        ? t('wizard.qqDetect.compatUnknown')
        : kind === 'too-old'
          ? t('wizard.qqDetect.compatTooOld')
          : t('wizard.qqDetect.compatBad');
  return (
    <Badge variant={variant} className="px-3 py-1">{message}</Badge>
  );
}
