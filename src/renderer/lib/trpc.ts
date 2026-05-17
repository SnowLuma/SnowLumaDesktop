import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../main/trpc/router';
import { snowlumaIpcLink } from './snowluma-ipc-link';

export const trpc = createTRPCReact<AppRouter>();

export const trpcClientConfig = {
  links: [snowlumaIpcLink<AppRouter>()],
};
