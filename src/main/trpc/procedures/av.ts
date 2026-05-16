import { z } from 'zod';
import { publicProcedure, router } from '../init';
import { buildDefenderWhitelistScript, detectAv, runDefenderWhitelistElevated } from '../../services/av-detector';

export const avRouter = router({
  detect: publicProcedure.query(() => detectAv()),

  whitelistScript: publicProcedure
    .input(z.object({ extraPaths: z.array(z.string()).default([]) }).optional())
    .query(({ input }) => buildDefenderWhitelistScript(input?.extraPaths ?? [])),

  /**
   * Triggers an elevated PowerShell that adds paths to Defender's
   * exclusion list. The OS UAC dialog handles the actual elevation;
   * Desktop only knows whether the launch was issued, not whether the
   * user approved.
   */
  runWhitelist: publicProcedure
    .input(z.object({ extraPaths: z.array(z.string()).default([]) }).optional())
    .mutation(({ input }) => runDefenderWhitelistElevated(input?.extraPaths ?? [])),
});
