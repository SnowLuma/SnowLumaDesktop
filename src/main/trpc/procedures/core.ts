import { existsSync } from 'node:fs';
import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { publicProcedure, router } from '../init';
import { coreVersionsDir } from '../../util/paths';
import { downloadAndExtract } from '../../services/download-manager';
import { loginWebui, waitForCoreReady } from '../../services/webui-session';
import { broadcastEvent } from '../../ipc/event-bus';

export const coreRouter = router({
  state: publicProcedure.query(({ ctx }) => ctx.services.core.getState()),

  start: publicProcedure.mutation(async ({ ctx }) => {
    await ctx.services.core.start();
  }),
  stop: publicProcedure.mutation(async ({ ctx }) => {
    await ctx.services.core.stop();
  }),
  restart: publicProcedure.mutation(async ({ ctx }) => {
    await ctx.services.core.restart();
  }),

  /**
   * Probe core's webui until it answers; then return a logged-in URL that
   * the renderer iframe can navigate to.
   */
  webuiUrl: publicProcedure
    .input(z.object({ botUin: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const state = ctx.services.core.getState();
      if (!state.webuiPort) return { url: null, ready: false };
      const ready = await waitForCoreReady(state.webuiPort, 5_000);
      if (!ready) return { url: null, ready: false };
      const { token } = await loginWebui(state.webuiPort).catch(() => ({ token: null }));
      if (!token) return { url: null, ready: false };
      const search = new URLSearchParams();
      search.set('token', token);
      if (input.botUin) search.set('botUin', input.botUin);
      return {
        url: `http://127.0.0.1:${state.webuiPort}/?${search.toString()}`,
        ready: true,
        port: state.webuiPort,
      };
    }),

  versions: router({
    list: publicProcedure.query(({ ctx }) => ({
      installed: ctx.store.get('installedCoreVersions'),
      active: ctx.store.get('activeCoreVersion'),
    })),

    download: publicProcedure
      .input(
        z.object({
          version: z.string().min(1),
          file: z.string().min(1),
          expectedSha256: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const versionDir = join(coreVersionsDir(), input.version);
        const eventId = `core:${input.version}`;
        try {
          const result = await downloadAndExtract(ctx.store.get('mirrors'), {
            version: input.version,
            file: input.file,
            destDir: join(versionDir, '_download'),
            expectedSha256: input.expectedSha256,
            extractTo: versionDir,
            onProgress: (p) => {
              broadcastEvent({
                kind: 'download:progress',
                id: eventId,
                bytesDone: p.bytesDone,
                bytesTotal: p.bytesTotal,
                speedBytesPerSec: p.speedBytesPerSec,
                mirrorId: p.mirrorId,
                attempt: p.attempt,
              });
            },
          });
          broadcastEvent({ kind: 'download:done', id: eventId, bytesTotal: result.bytesTotal });
          const installed = new Set(ctx.store.get('installedCoreVersions'));
          installed.add(input.version);
          ctx.store.set('installedCoreVersions', Array.from(installed));
          return result;
        } catch (err) {
          broadcastEvent({
            kind: 'download:error',
            id: eventId,
            message: err instanceof Error ? err.message : String(err),
          });
          throw err;
        }
      }),

    switch: publicProcedure
      .input(z.object({ version: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const installed = ctx.store.get('installedCoreVersions');
        if (!installed.includes(input.version)) {
          throw new Error(`version ${input.version} not installed`);
        }
        await ctx.services.core.setActiveVersion(input.version);
      }),

    delete: publicProcedure
      .input(z.object({ version: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const active = ctx.store.get('activeCoreVersion');
        if (active === input.version) {
          throw new Error('cannot delete the active version; switch first');
        }
        const dir = join(coreVersionsDir(), input.version);
        if (existsSync(dir)) await rm(dir, { recursive: true, force: true });
        const installed = ctx.store.get('installedCoreVersions').filter((v) => v !== input.version);
        ctx.store.set('installedCoreVersions', installed);
      }),

    /** Reconcile electron-store with what's actually on disk. */
    sync: publicProcedure.mutation(async ({ ctx }) => {
      const dir = coreVersionsDir();
      if (!existsSync(dir)) {
        ctx.store.set('installedCoreVersions', []);
        return [];
      }
      const entries = await readdir(dir, { withFileTypes: true });
      const versions = entries.filter((e) => e.isDirectory()).map((e) => e.name);
      ctx.store.set('installedCoreVersions', versions);
      return versions;
    }),
  }),
});
