import {
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

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: async () => {
    const { completedAt } = await trpcVanilla.wizard.state.query();
    throw redirect({ to: completedAt ? '/app/bots' : '/wizard/welcome' });
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

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
