import { TRPCClientError, type TRPCLink } from '@trpc/client';
import { observable } from '@trpc/server/observable';
import type { AnyRouter } from '@trpc/server';
import type { IpcTrpcRequest } from '@shared/ipc-protocol';

/**
 * Custom tRPC link that talks to the main process over Electron IPC via
 * `window.snowlumaIpc` (exposed by preload). Replaces electron-trpc,
 * which is hard-coded to tRPC v10's router internals and crashes on
 * v11 with `getErrorShape is not a function`.
 *
 * Subscriptions aren't supported here yet — they'd need a separate
 * `ipcRenderer.on(channel, ...)` for streaming emissions.
 */
export function snowlumaIpcLink<TRouter extends AnyRouter>(): TRPCLink<TRouter> {
  return () => {
    return ({ op }) =>
      observable((observer) => {
        let cancelled = false;
        const req: IpcTrpcRequest = {
          path: op.path,
          type: op.type,
          input: op.input,
        };
        const bridge = globalThis.window?.snowlumaIpc;
        if (!bridge) {
          observer.error(
            new TRPCClientError(
              'snowlumaIpc bridge missing — preload script did not run or `?preview=1` mock is not installed',
            ),
          );
          return () => {
            cancelled = true;
          };
        }
        bridge
          .request(req)
          .then((res) => {
            if (cancelled) return;
            if (res.ok) {
              observer.next({ result: { type: 'data', data: res.data } });
              observer.complete();
            } else {
              observer.error(
                new TRPCClientError(res.error.message, {
                  result: {
                    error: {
                      message: res.error.message,
                      code: -32000,
                      data: {
                        code: res.error.code ?? 'INTERNAL_SERVER_ERROR',
                        httpStatus: res.error.httpStatus ?? 500,
                        path: res.error.path,
                      },
                    },
                  },
                }),
              );
            }
          })
          .catch((err: unknown) => {
            if (cancelled) return;
            const message = err instanceof Error ? err.message : String(err);
            observer.error(new TRPCClientError(message));
          });
        return () => {
          cancelled = true;
        };
      });
  };
}
