import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@snowluma/ui';
import { PartyPopper } from 'lucide-react';
import { trpc } from '../../lib/trpc';

export function DoneStep() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const complete = trpc.wizard.complete.useMutation({
    onSuccess: () => {
      void utils.wizard.state.invalidate();
      void navigate({ to: '/app/bots' });
    },
  });

  return (
    <section className="space-y-6 text-center">
      <PartyPopper className="mx-auto size-12 text-primary" />
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">{t('wizard.done.title')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('wizard.done.subtitle')}</p>
      </header>
      <Button onClick={() => complete.mutate()} disabled={complete.isPending}>
        {complete.isPending ? t('wizard.done.entering') : t('wizard.done.enter')}
      </Button>
    </section>
  );
}
