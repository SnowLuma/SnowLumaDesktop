import { createTRPCReact } from '@trpc/react-query';
import { ipcLink } from 'electron-trpc/renderer';
import type { TRPCLink } from '@trpc/client';
import type { AppRouter } from '../../main/trpc/router';

export const trpc = createTRPCReact<AppRouter>();

/**
 * electron-trpc 0.7.1's ipcLink still uses the v10 contract where the
 * link runtime carries `transformer.serialize`. tRPC v11 only sets that
 * if a transformer was passed to the link itself, and `ipcLink()` takes
 * no options. Wrap the link to inject a no-op transformer on the
 * runtime so `runtime.transformer.serialize(input)` doesn't blow up.
 */
const noopTransformer = {
  serialize: <T>(x: T): T => x,
  deserialize: <T>(x: T): T => x,
};

function ipcLinkPatched(): TRPCLink<AppRouter> {
  const inner = ipcLink<AppRouter>();
  return (runtime) => {
    // tRPC v11's TRPCClientRuntime type doesn't expose `transformer`, but
    // electron-trpc 0.7.1 still reads it at runtime. Patch via cast.
    const r = runtime as unknown as { transformer?: typeof noopTransformer };
    const patched = { ...runtime, transformer: r.transformer ?? noopTransformer };
    return inner(patched as Parameters<typeof inner>[0]);
  };
}

export const trpcClientConfig = {
  links: [ipcLinkPatched()],
};
