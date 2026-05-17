import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { trpcVanilla } from '../lib/trpc-vanilla';
import { WelcomeStep } from '../routes/wizard/welcome';
import { NetworkStep } from '../routes/wizard/network';
import { AvStep } from '../routes/wizard/av';
import { CoreDownloadStep } from '../routes/wizard/core-download';
import { QqDetectStep } from '../routes/wizard/qq-detect';
import { AddBotStep } from '../routes/wizard/add-bot';
import { PrefsStep } from '../routes/wizard/prefs';
import { DoneStep } from '../routes/wizard/done';
import { MainShell } from '../routes/app/main-shell';
import { BotsView } from '../routes/app/bots';
import { LogsView } from '../routes/app/logs';
import { SettingsView } from '../routes/app/settings';
import { DiagnosticView } from '../routes/app/diagnostic';
import { UpdateView } from '../routes/app/update';
import { WizardShell } from '../routes/wizard/wizard-shell';
import { NotFound } from '../components/not-found';
import { AppError } from '../components/app-error';

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: NotFound,
  errorComponent: ({ error, reset }) => <AppError error={error} reset={reset} />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: async () => {
    try {
      const state = await trpcVanilla.wizard.state.query();
      const target = state.completedAt ? '/app/bots' : '/wizard/welcome';
      // eslint-disable-next-line no-console
      console.info(`[router] indexRoute resolved wizard.state → completedAt=${state.completedAt} → ${target}`);
      throw redirect({ to: target });
    } catch (err) {
      // Redirects throw — let them through.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.isRedirect) throw err;
      // Unknown state on first launch → wizard is the safer default.
      // The user can always skip from there if they're an existing
      // installer doing a fresh portable run.
      // eslint-disable-next-line no-console
      console.warn(
        `[router] indexRoute failed wizard.state query, defaulting to wizard. err=${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw redirect({ to: '/wizard/welcome' });
    }
  },
  component: () => <Navigate to="/wizard/welcome" />,
});

const wizardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wizard',
  component: WizardShell,
});

const wizardWelcome = createRoute({
  getParentRoute: () => wizardRoute,
  path: '/welcome',
  component: WelcomeStep,
});
const wizardNetwork = createRoute({
  getParentRoute: () => wizardRoute,
  path: '/network',
  component: NetworkStep,
});
const wizardAv = createRoute({
  getParentRoute: () => wizardRoute,
  path: '/av',
  component: AvStep,
});
const wizardCoreDownload = createRoute({
  getParentRoute: () => wizardRoute,
  path: '/core-download',
  component: CoreDownloadStep,
});
const wizardQqDetect = createRoute({
  getParentRoute: () => wizardRoute,
  path: '/qq-detect',
  component: QqDetectStep,
});
const wizardAddBot = createRoute({
  getParentRoute: () => wizardRoute,
  path: '/add-bot',
  component: AddBotStep,
});
const wizardPrefs = createRoute({
  getParentRoute: () => wizardRoute,
  path: '/prefs',
  component: PrefsStep,
});
const wizardDone = createRoute({
  getParentRoute: () => wizardRoute,
  path: '/done',
  component: DoneStep,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  component: MainShell,
});

const appBots = createRoute({
  getParentRoute: () => appRoute,
  path: '/bots',
  component: BotsView,
});
const appBotsDetail = createRoute({
  getParentRoute: () => appRoute,
  path: '/bots/$uin',
  component: BotsView,
});
const appLogs = createRoute({
  getParentRoute: () => appRoute,
  path: '/logs',
  component: LogsView,
});
const appSettings = createRoute({
  getParentRoute: () => appRoute,
  path: '/settings',
  component: SettingsView,
});
const appDiagnostic = createRoute({
  getParentRoute: () => appRoute,
  path: '/diagnostic',
  component: DiagnosticView,
});
const appUpdate = createRoute({
  getParentRoute: () => appRoute,
  path: '/update',
  component: UpdateView,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  wizardRoute.addChildren([
    wizardWelcome,
    wizardNetwork,
    wizardAv,
    wizardCoreDownload,
    wizardQqDetect,
    wizardAddBot,
    wizardPrefs,
    wizardDone,
  ]),
  appRoute.addChildren([appBots, appBotsDetail, appLogs, appSettings, appDiagnostic, appUpdate]),
]);

// Hash-based history. Electron loads the renderer over file:// whose
// pathname is something like `/C:/Users/…/index.html` — TanStack
// Router can't reconcile that with our `/wizard/welcome` route table
// and falls through to the not-found component (the "路径不存在"
// screen the user saw on first launch). With hash history the router
// only looks at the part after `#`, so the file:// vs http:// /
// vite-preview difference disappears.
export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  history: createHashHistory(),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
