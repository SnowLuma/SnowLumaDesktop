import { createTRPCClient } from '@trpc/client';
import type { AppRouter } from '../../main/trpc/router';
import { trpcClientConfig } from './trpc';

/**
 * Non-React tRPC client. Used for route loaders / beforeLoad guards / places
 * where we can't call hooks (e.g. router config). Shares the same patched
 * link config as the React client.
 */
export const trpcVanilla = createTRPCClient<AppRouter>(trpcClientConfig);
