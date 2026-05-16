import { createTRPCClient } from '@trpc/client';
import { ipcLink } from 'electron-trpc/renderer';
import type { AppRouter } from '../../main/trpc/router';

/**
 * Non-React tRPC client. Used for route loaders / beforeLoad guards / places
 * where we can't call hooks (e.g. router config).
 */
export const trpcVanilla = createTRPCClient<AppRouter>({
  links: [ipcLink()],
});
