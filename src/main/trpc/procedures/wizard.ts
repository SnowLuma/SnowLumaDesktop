import { z } from 'zod';
import { publicProcedure, router } from '../init';

const wizardStepSchema = z.enum([
  'welcome',
  'network',
  'av',
  'core-download',
  'qq-detect',
  'add-bot',
  'prefs',
  'done',
]);

export const wizardRouter = router({
  state: publicProcedure.query(({ ctx }) => ({
    step: ctx.store.get('wizardStep'),
    completedAt: ctx.store.get('wizardCompletedAt'),
  })),

  setStep: publicProcedure.input(z.object({ step: wizardStepSchema })).mutation(({ ctx, input }) => {
    ctx.store.set('wizardStep', input.step);
  }),

  complete: publicProcedure.mutation(({ ctx }) => {
    ctx.store.set('wizardStep', 'done');
    ctx.store.set('wizardCompletedAt', Date.now());
  }),

  reset: publicProcedure.mutation(({ ctx }) => {
    ctx.store.set('wizardStep', 'welcome');
    ctx.store.set('wizardCompletedAt', null);
  }),

  skip: publicProcedure.mutation(({ ctx }) => {
    ctx.store.set('wizardCompletedAt', Date.now());
    ctx.store.set('wizardStep', 'done');
  }),
});
