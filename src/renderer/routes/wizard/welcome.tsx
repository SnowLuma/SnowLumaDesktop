import { useTranslation } from 'react-i18next';
import { Button, Card, CardContent } from '@snowluma/ui';
import { ShieldAlert, Lock, ScanLine } from 'lucide-react';
import { useWizardNavigate } from './wizard-shell';

export function WelcomeStep() {
  const { t } = useTranslation();
  const { next } = useWizardNavigate();
  return (
    <section className="space-y-6">
      <header className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight">{t('wizard.welcome.title')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('wizard.welcome.subtitle')}</p>
      </header>
      <Card>
        <CardContent className="space-y-4 p-6">
          <Fact icon={<Lock className="size-5 text-primary" />} title={t('wizard.welcome.factLocal.title')} body={t('wizard.welcome.factLocal.body')} />
          <Fact icon={<ScanLine className="size-5 text-primary" />} title={t('wizard.welcome.factHook.title')} body={t('wizard.welcome.factHook.body')} />
          <Fact icon={<ShieldAlert className="size-5 text-warning" />} title={t('wizard.welcome.factAv.title')} body={t('wizard.welcome.factAv.body')} />
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button onClick={() => next('welcome')}>{t('wizard.welcome.accept')}</Button>
      </div>
    </section>
  );
}

function Fact({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <div className="pt-0.5">{icon}</div>
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
