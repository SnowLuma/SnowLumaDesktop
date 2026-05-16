import { useTranslation } from 'react-i18next';
import { Button, Card, CardContent, Label, Switch } from '@snowluma/ui';
import { trpc } from '../../lib/trpc';
import { useWizardNavigate } from './wizard-shell';

export function PrefsStep() {
  const { t } = useTranslation();
  const { next, back } = useWizardNavigate();
  const utils = trpc.useUtils();
  const prefs = trpc.app.prefs.get.useQuery();
  const setPrefs = trpc.app.prefs.set.useMutation({ onSuccess: () => utils.app.prefs.get.invalidate() });

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">{t('wizard.prefs.title')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('wizard.prefs.subtitle')}</p>
      </header>
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('wizard.prefs.autostart')}</Label>
              <p className="text-xs text-muted-foreground">{t('wizard.prefs.autostartHint')}</p>
            </div>
            <Switch
              checked={prefs.data?.autostartEnabled ?? false}
              onCheckedChange={(checked) => setPrefs.mutate({ autostartEnabled: checked === true })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('wizard.prefs.openMainOnLaunch')}</Label>
              <p className="text-xs text-muted-foreground">{t('wizard.prefs.openMainOnLaunchHint')}</p>
            </div>
            <Switch
              checked={prefs.data?.autostartOpenMainWindow ?? false}
              onCheckedChange={(checked) => setPrefs.mutate({ autostartOpenMainWindow: checked === true })}
              disabled={!prefs.data?.autostartEnabled}
            />
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => back('prefs')}>{t('wizard.back')}</Button>
        <Button onClick={() => next('prefs')}>{t('wizard.next')}</Button>
      </div>
    </section>
  );
}
