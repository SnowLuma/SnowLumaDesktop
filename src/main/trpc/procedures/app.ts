import { app } from 'electron';
import { z } from 'zod';
import { APP_NAME } from '@shared/constants';
import type { AppInfo } from '@shared/types';
import { publicProcedure, router } from '../init';
import { applyAutostartPreference } from '../../services/autostart';

export const appRouter = router({
  info: publicProcedure.query((): AppInfo => {
    return {
      name: APP_NAME,
      version: app.getVersion(),
      electron: process.versions.electron ?? 'unknown',
      chrome: process.versions.chrome ?? 'unknown',
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
      isPackaged: app.isPackaged,
    };
  }),

  /** UI prefs. */
  prefs: router({
    get: publicProcedure.query(({ ctx }) => ({
      theme: ctx.store.get('theme'),
      language: ctx.store.get('language'),
      autostartEnabled: ctx.store.get('autostartEnabled'),
      autostartOpenMainWindow: ctx.store.get('autostartOpenMainWindow'),
      trayHintShown: ctx.store.get('trayHintShown'),
    })),
    set: publicProcedure
      .input(
        z.object({
          theme: z.enum(['light', 'dark', 'system']).optional(),
          language: z.enum(['zh-CN', 'en-US']).optional(),
          autostartEnabled: z.boolean().optional(),
          autostartOpenMainWindow: z.boolean().optional(),
          trayHintShown: z.boolean().optional(),
        }),
      )
      .mutation(({ ctx, input }) => {
        if (input.theme !== undefined) ctx.store.set('theme', input.theme);
        if (input.language !== undefined) ctx.store.set('language', input.language);
        if (input.autostartEnabled !== undefined) {
          ctx.store.set('autostartEnabled', input.autostartEnabled);
        }
        if (input.autostartOpenMainWindow !== undefined) {
          ctx.store.set('autostartOpenMainWindow', input.autostartOpenMainWindow);
        }
        if (input.trayHintShown !== undefined) {
          ctx.store.set('trayHintShown', input.trayHintShown);
        }
        if (input.autostartEnabled !== undefined || input.autostartOpenMainWindow !== undefined) {
          applyAutostartPreference();
        }
      }),
  }),

  /** Quit / minimise / show — surfaced for the renderer chrome buttons. */
  window: router({
    quit: publicProcedure.mutation(() => {
      app.exit(0);
    }),
  }),
});
