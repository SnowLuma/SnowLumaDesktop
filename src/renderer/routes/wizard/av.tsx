import { useTranslation } from 'react-i18next';
import { Button, Card, CardContent, Badge } from '@snowluma/ui';
import { Shield, ShieldCheck, ShieldOff, AlertTriangle } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { useWizardNavigate } from './wizard-shell';

export function AvStep() {
  const { t } = useTranslation();
  const { next, back } = useWizardNavigate();
  const detect = trpc.av.detect.useQuery(undefined, { refetchOnWindowFocus: false });
  const runWhitelist = trpc.av.runWhitelist.useMutation();

  const defender = detect.data?.defender;
  const thirdParty = detect.data?.thirdParty ?? [];

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">{t('wizard.av.title')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('wizard.av.subtitle')}</p>
      </header>
      <Card>
        <CardContent className="space-y-4 p-6">
          {!detect.data && <p className="text-sm text-muted-foreground">{t('wizard.av.detecting')}</p>}
          {defender && (
            <div className="flex items-start gap-3">
              {defender.status === 'running' ? (
                <Shield className="size-5 text-warning" />
              ) : defender.status === 'off' ? (
                <ShieldOff className="size-5 text-muted-foreground" />
              ) : (
                <Shield className="size-5 text-muted-foreground" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  Windows Defender
                  <Badge variant={defender.status === 'running' ? 'warning' : 'secondary'}>
                    {defender.status === 'running' ? '运行中' : defender.status === 'off' ? '关闭' : '未知'}
                  </Badge>
                </div>
                {defender.status === 'running' && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('wizard.av.defenderRunning')}
                  </p>
                )}
              </div>
              {defender.status === 'running' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => runWhitelist.mutate({ extraPaths: [] })}
                  disabled={runWhitelist.isPending}
                >
                  <ShieldCheck className="size-4" />
                  {runWhitelist.isPending ? t('wizard.av.whitelisting') : t('wizard.av.addWhitelist')}
                </Button>
              )}
            </div>
          )}
          {thirdParty.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="size-4 text-warning" />
                {t('wizard.av.thirdPartyDetected', { count: thirdParty.length })}
              </div>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {thirdParty.map((av) => (
                  <li key={av.name}>· {av.name} ({av.processName})</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                {t('wizard.av.thirdPartyHint')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => back('av')}>{t('wizard.back')}</Button>
        <Button onClick={() => next('av')}>{t('wizard.next')}</Button>
      </div>
    </section>
  );
}
