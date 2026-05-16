import { z } from 'zod';
import { publicProcedure, router } from '../init';
import type { MirrorEntry } from '../../store/schema';

const mirrorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  template: z.string().url().or(z.string().startsWith('http')),
  priority: z.number().int(),
  enabled: z.boolean(),
});

export const mirrorsRouter = router({
  list: publicProcedure.query(({ ctx }) => ctx.store.get('mirrors')),

  upsert: publicProcedure.input(mirrorSchema).mutation(({ ctx, input }) => {
    const list = ctx.store.get('mirrors').slice();
    const idx = list.findIndex((m) => m.id === input.id);
    const entry: MirrorEntry = { ...input };
    if (idx >= 0) {
      list[idx] = entry;
    } else {
      list.push(entry);
    }
    ctx.store.set('mirrors', list);
    return entry;
  }),

  delete: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ ctx, input }) => {
      const list = ctx.store.get('mirrors').filter((m) => m.id !== input.id);
      ctx.store.set('mirrors', list);
    }),

  reorder: publicProcedure
    .input(z.object({ orderedIds: z.array(z.string()) }))
    .mutation(({ ctx, input }) => {
      const map = new Map(ctx.store.get('mirrors').map((m) => [m.id, m]));
      const reordered: MirrorEntry[] = [];
      input.orderedIds.forEach((id, i) => {
        const entry = map.get(id);
        if (entry) {
          reordered.push({ ...entry, priority: input.orderedIds.length - i });
          map.delete(id);
        }
      });
      for (const remaining of map.values()) {
        reordered.push(remaining);
      }
      ctx.store.set('mirrors', reordered);
    }),
});
