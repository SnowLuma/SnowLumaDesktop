import { z } from 'zod';
import { publicProcedure, router } from '../init';
import type { BotRecord } from '@shared/types';

const botRecordSchema = z.object({
  uin: z.string().regex(/^\d{5,12}$/),
  customName: z.string().default(''),
  qqPath: z.string().min(1),
  launchMode: z.enum(['desktop', 'user']),
  hideQqWindowAfterLogin: z.boolean(),
  createdAt: z.number().int(),
});

export const botRouter = router({
  list: publicProcedure.query(({ ctx }) => ctx.services.bots.listBots()),
  states: publicProcedure.query(({ ctx }) => ctx.services.bots.getStates()),

  upsert: publicProcedure.input(botRecordSchema).mutation(({ ctx, input }) => {
    const record: BotRecord = input;
    return ctx.services.bots.upsertBot(record);
  }),

  rename: publicProcedure
    .input(z.object({ uin: z.string(), customName: z.string() }))
    .mutation(({ ctx, input }) => {
      const bots = ctx.store.get('bots');
      const record = bots[input.uin];
      if (!record) throw new Error(`bot ${input.uin} not found`);
      const updated = { ...record, customName: input.customName };
      ctx.services.bots.upsertBot(updated);
      return updated;
    }),

  start: publicProcedure.input(z.object({ uin: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.services.bots.start(input.uin);
  }),

  stop: publicProcedure.input(z.object({ uin: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.services.bots.stop(input.uin);
  }),

  /**
   * Stage delete: move data to .trash, return entry id for undo.
   * Caller must invoke `delete.finalize` after the 5s undo window.
   */
  delete: router({
    stage: publicProcedure
      .input(
        z.object({
          uin: z.string(),
          withData: z.boolean().default(false),
          withConfig: z.boolean().default(false),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return ctx.services.bots.stageDelete(input.uin, {
          withData: input.withData,
          withConfig: input.withConfig,
        });
      }),
    undo: publicProcedure
      .input(z.object({ trashEntry: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.services.bots.undoDelete(input.trashEntry);
      }),
    finalize: publicProcedure
      .input(z.object({ trashEntry: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.services.bots.finalizeDelete(input.trashEntry);
      }),
  }),

  /** Mark a Bot as online — usually called by an internal poll loop, but
   *  exposed for completeness (e.g. webui pushes via core REST). */
  markOnline: publicProcedure
    .input(z.object({ uin: z.string() }))
    .mutation(({ ctx, input }) => {
      ctx.services.bots.markOnline(input.uin);
    }),

  import: router({
    findOrphans: publicProcedure.query(({ ctx }) => ctx.services.bots.findOrphanBotDirs()),
  }),
});
