import { z } from 'zod';
import { publicProcedure, router } from '../init';

export const updaterRouter = router({
  channel: publicProcedure.query(({ ctx }) => ctx.store.get('updateChannel')),
  setChannel: publicProcedure
    .input(z.object({ channel: z.enum(['main', 'dev']) }))
    .mutation(({ ctx, input }) => {
      ctx.services.updater.setChannel(input.channel);
    }),
  check: publicProcedure.query(({ ctx }) => ctx.services.updater.check()),
  download: publicProcedure.mutation(({ ctx }) => ctx.services.updater.download()),
  quitAndInstall: publicProcedure.mutation(({ ctx }) => {
    ctx.services.updater.quitAndInstall();
  }),
});
