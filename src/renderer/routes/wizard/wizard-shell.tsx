import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, cn } from '@snowluma/ui';
import { trpc } from '../../lib/trpc';
import type { WizardStep } from '@shared/types';

const STEP_ORDER: { step: WizardStep; path: string; labelKey: string }[] = [
  { step: 'welcome', path: '/wizard/welcome', labelKey: 'wizard.steps.welcome' },
  { step: 'network', path: '/wizard/network', labelKey: 'wizard.steps.network' },
  { step: 'av', path: '/wizard/av', labelKey: 'wizard.steps.av' },
  { step: 'core-download', path: '/wizard/core-download', labelKey: 'wizard.steps.coreDownload' },
  { step: 'qq-detect', path: '/wizard/qq-detect', labelKey: 'wizard.steps.qqDetect' },
  { step: 'add-bot', path: '/wizard/add-bot', labelKey: 'wizard.steps.addBot' },
  { step: 'prefs', path: '/wizard/prefs', labelKey: 'wizard.steps.prefs' },
  { step: 'done', path: '/wizard/done', labelKey: 'wizard.steps.done' },
];

export function WizardShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const stateQuery = trpc.wizard.state.useQuery();
  const setStep = trpc.wizard.setStep.useMutation();
  const skip = trpc.wizard.skip.useMutation();
  const routerState = useRouterState();

  const currentPath = routerState.location.pathname;
  const currentIndex = Math.max(0, STEP_ORDER.findIndex((s) => currentPath.startsWith(s.path)));
  const persistedStep = stateQuery.data?.step ?? 'welcome';
  const persistedIndex = STEP_ORDER.findIndex((s) => s.step === persistedStep);

  useEffect(() => {
    if (!stateQuery.data) return;
    // 12b · resume from last persisted step if user landed on a different route
    if (currentPath === '/wizard' || currentPath === '/wizard/') {
      const target = STEP_ORDER.find((s) => s.step === persistedStep) ?? STEP_ORDER[0]!;
      void navigate({ to: target.path });
    }
  }, [stateQuery.data, currentPath, navigate, persistedStep]);

  function go(targetIndex: number) {
    const target = STEP_ORDER[Math.max(0, Math.min(STEP_ORDER.length - 1, targetIndex))]!;
    setStep.mutate(
      { step: target.step },
      { onSuccess: () => void utils.wizard.state.invalidate() },
    );
    void navigate({ to: target.path });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card px-8 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold">❄️ {t('app.name')}</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              skip.mutate(undefined, {
                onSuccess: () => {
                  void utils.wizard.state.invalidate();
                  void navigate({ to: '/app/bots' });
                },
              })
            }
          >
            {t('wizard.skip')}
          </Button>
        </div>
        <ol className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          {STEP_ORDER.map((s, i) => {
            const reached = i <= Math.max(currentIndex, persistedIndex);
            const isCurrent = i === currentIndex;
            return (
              <li key={s.step} className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={i > persistedIndex}
                  onClick={() => go(i)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition',
                    isCurrent && 'bg-primary text-primary-foreground',
                    !isCurrent && reached && 'bg-accent text-accent-foreground',
                    !reached && 'opacity-60',
                  )}
                >
                  <span className="inline-flex size-4 items-center justify-center rounded-full border border-current text-[10px]">
                    {i + 1}
                  </span>
                  <span>{t(s.labelKey)}</span>
                </button>
                {i < STEP_ORDER.length - 1 && <span aria-hidden="true">›</span>}
              </li>
            );
          })}
        </ol>
      </header>
      <main className="flex flex-1 flex-col px-8 py-10">
        <div className="mx-auto w-full max-w-2xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function useWizardNavigate() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const setStep = trpc.wizard.setStep.useMutation();

  function next(currentStep: WizardStep) {
    const i = STEP_ORDER.findIndex((s) => s.step === currentStep);
    const target = STEP_ORDER[Math.min(STEP_ORDER.length - 1, i + 1)]!;
    setStep.mutate(
      { step: target.step },
      { onSuccess: () => void utils.wizard.state.invalidate() },
    );
    void navigate({ to: target.path });
  }
  function back(currentStep: WizardStep) {
    const i = STEP_ORDER.findIndex((s) => s.step === currentStep);
    const target = STEP_ORDER[Math.max(0, i - 1)]!;
    void navigate({ to: target.path });
  }
  return { next, back };
}
