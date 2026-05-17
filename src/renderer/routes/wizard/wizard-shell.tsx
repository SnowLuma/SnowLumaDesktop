import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, cn, ScrollArea } from '@snowluma/ui';
import { Snowflake, ChevronRight } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { ThemeToggle } from '../../components/theme-toggle';
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
    if (currentPath === '/wizard' || currentPath === '/wizard/') {
      const target = STEP_ORDER.find((s) => s.step === persistedStep) ?? STEP_ORDER[0]!;
      void navigate({ to: target.path });
    }
  }, [stateQuery.data, currentPath, navigate, persistedStep]);

  function go(targetIndex: number) {
    const target = STEP_ORDER[Math.max(0, Math.min(STEP_ORDER.length - 1, targetIndex))]!;
    setStep.mutate({ step: target.step }, { onSuccess: () => void utils.wizard.state.invalidate() });
    void navigate({ to: target.path });
  }

  const progress = Math.round(((currentIndex + 1) / STEP_ORDER.length) * 100);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex h-chrome shrink-0 items-center gap-3 border-b border-border bg-card px-5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Snowflake className="size-4" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold leading-tight">{t('app.name')}</h1>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">首次设置向导</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle compact />
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
      </header>

      {/* Progress bar */}
      <div className="h-0.5 shrink-0 bg-border">
        <div
          className="h-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stepper */}
      <ScrollArea className="shrink-0">
        <ol className="flex items-center gap-1.5 border-b border-border bg-card/40 px-5 py-2 text-[11px] text-muted-foreground">
          {STEP_ORDER.map((s, i) => {
            const reached = i <= Math.max(currentIndex, persistedIndex);
            const isCurrent = i === currentIndex;
            return (
              <li key={s.step} className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  disabled={i > persistedIndex}
                  onClick={() => go(i)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors',
                    isCurrent && 'bg-primary text-primary-foreground shadow-sm',
                    !isCurrent && reached && 'bg-accent text-accent-foreground hover:bg-accent/80',
                    !reached && 'opacity-50',
                    'disabled:cursor-not-allowed',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex size-4 items-center justify-center rounded-full border text-[9px] font-semibold',
                      isCurrent ? 'border-primary-foreground' : 'border-current',
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="whitespace-nowrap">{t(s.labelKey)}</span>
                </button>
                {i < STEP_ORDER.length - 1 && (
                  <ChevronRight className="size-3 shrink-0 text-muted-foreground/40" />
                )}
              </li>
            );
          })}
        </ol>
      </ScrollArea>

      <ScrollArea className="flex-1">
        <main className="px-6 py-8 lg:py-12">
          <div className="mx-auto w-full max-w-2xl animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
            <Outlet />
          </div>
        </main>
      </ScrollArea>
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
    setStep.mutate({ step: target.step }, { onSuccess: () => void utils.wizard.state.invalidate() });
    void navigate({ to: target.path });
  }
  function back(currentStep: WizardStep) {
    const i = STEP_ORDER.findIndex((s) => s.step === currentStep);
    const target = STEP_ORDER[Math.max(0, i - 1)]!;
    void navigate({ to: target.path });
  }
  return { next, back };
}

