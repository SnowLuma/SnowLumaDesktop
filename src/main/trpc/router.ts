import { router } from './init';
import { appRouter as appProcedures } from './procedures/app';
import { coreRouter } from './procedures/core';
import { wizardRouter } from './procedures/wizard';
import { qqRouter } from './procedures/qq';
import { avRouter } from './procedures/av';
import { botRouter } from './procedures/bot';
import { mirrorsRouter } from './procedures/mirrors';
import { updaterRouter } from './procedures/updater';
import { diagnosticRouter } from './procedures/diagnostic';

/**
 * Root tRPC router exposed to the renderer over Electron IPC.
 * Each domain is a sub-router so the renderer gets
 * `trpc.app.info`, `trpc.core.state`, `trpc.bot.list`, etc.
 */
export const appRouter = router({
  app: appProcedures,
  core: coreRouter,
  wizard: wizardRouter,
  qq: qqRouter,
  av: avRouter,
  bot: botRouter,
  mirrors: mirrorsRouter,
  updater: updaterRouter,
  diagnostic: diagnosticRouter,
});

export type AppRouter = typeof appRouter;
