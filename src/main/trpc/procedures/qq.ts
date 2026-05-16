import { z } from 'zod';
import { publicProcedure, router } from '../init';
import { detectQqInstall } from '../../services/qq-detector';
import { evaluateQqVersion, getQqCompatManifest } from '../../services/qq-compat';

export const qqRouter = router({
  detect: publicProcedure.query(async ({ ctx }) => {
    const install = await detectQqInstall();
    if (install) {
      ctx.store.set('qqInstall', { ...install, detectedAt: Date.now() });
    }
    return install;
  }),

  cached: publicProcedure.query(({ ctx }) => ctx.store.get('qqInstall')),

  setPath: publicProcedure
    .input(z.object({ path: z.string().min(1), version: z.string().nullable() }))
    .mutation(({ ctx, input }) => {
      ctx.store.set('qqInstall', { ...input, detectedAt: Date.now() });
      return ctx.store.get('qqInstall');
    }),

  compat: router({
    manifest: publicProcedure
      .input(z.object({ forceRefresh: z.boolean().default(false) }).optional())
      .query(({ input }) => getQqCompatManifest({ forceRefresh: input?.forceRefresh ?? false })),

    evaluate: publicProcedure
      .input(z.object({ version: z.string() }))
      .query(async ({ input }) => {
        const manifest = await getQqCompatManifest();
        return evaluateQqVersion(manifest, input.version);
      }),
  }),
});
