import { ipcMain, type BrowserWindow } from 'electron';
import { TRPCError } from '@trpc/server';
// tRPC v11's official dispatcher: takes a router + path + ctx and runs
// the matching procedure end-to-end (middleware, input parsing, output
// serialisation). Lives under the `unstable-core-do-not-import` entry,
// which is the maintainers' way of saying "this is internal but
// publicly exported for exactly these glue cases" — pinning to it is
// fine and survives v11 patch bumps.
import { callProcedure } from '@trpc/server/unstable-core-do-not-import';
import { appRouter } from '../trpc/router';
import { createContext } from '../trpc/context';
import { createLogger } from '../util/logger';
import {
  SNOWLUMA_IPC_CHANNEL,
  type IpcTrpcRequest,
  type IpcTrpcResponse,
} from '@shared/ipc-protocol';

const log = createLogger('ipc');

/**
 * tRPC-over-IPC bridge for tRPC v11.
 *
 * Why callProcedure (not createCaller + path walk): in v11, the caller
 * returned by `createCallerFactory(router)(ctx)` is a Proxy whose
 * nested children resolve at access time. Manually walking the path
 * with `caller.app.prefs.get` returns undefined for nested routers
 * (the "procedure not found: app.prefs.get" bug we just hit).
 * `callProcedure` is the canonical dispatcher used internally by every
 * official adapter (http, ws, fetch) and looks up the procedure on
 * `router._def.procedures` (the flat dotted record).
 */
export function attachTrpcBridge(_windows: BrowserWindow[]): void {
  void _windows; // kept for API parity; ipcMain.handle routes per-event
  ipcMain.removeHandler(SNOWLUMA_IPC_CHANNEL);
  ipcMain.handle(SNOWLUMA_IPC_CHANNEL, async (_event, raw: unknown): Promise<IpcTrpcResponse> => {
    if (!isRequest(raw)) {
      return errorResponse(
        new TRPCError({ code: 'BAD_REQUEST', message: 'invalid ipc request shape' }),
        '',
      );
    }
    const req = raw;
    if (req.type === 'subscription') {
      return errorResponse(
        new TRPCError({
          code: 'METHOD_NOT_SUPPORTED',
          message: 'subscriptions are not yet wired in IPC',
        }),
        req.path,
      );
    }
    try {
      const data = await callProcedure({
        router: appRouter,
        path: req.path,
        getRawInput: async () => req.input,
        ctx: createContext(),
        type: req.type,
        signal: undefined,
        batchIndex: 0,
      });
      return { ok: true, data };
    } catch (err) {
      return errorResponse(err, req.path);
    }
  });
  log.info(`ipc bridge attached on channel "${SNOWLUMA_IPC_CHANNEL}"`);
}

function isRequest(value: unknown): value is IpcTrpcRequest {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<IpcTrpcRequest>;
  return (
    typeof v.path === 'string' &&
    (v.type === 'query' || v.type === 'mutation' || v.type === 'subscription')
  );
}

function errorResponse(err: unknown, path: string): IpcTrpcResponse {
  const trpcErr = err instanceof TRPCError ? err : null;
  const cause = err instanceof Error ? err : null;
  const message = (cause?.message ?? trpcErr?.message ?? String(err)) || 'unknown error';
  const code = trpcErr?.code ?? 'INTERNAL_SERVER_ERROR';
  log.warn(`ipc call ${path || '<unknown>'} failed: ${message}`);
  return {
    ok: false,
    error: {
      message,
      code,
      path: path || undefined,
      cause: cause && cause !== trpcErr ? cause.message : undefined,
    },
  };
}
