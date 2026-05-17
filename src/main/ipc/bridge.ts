import { ipcMain, type BrowserWindow } from 'electron';
import { TRPCError } from '@trpc/server';
import { appRouter } from '../trpc/router';
import { createCallerFactory } from '../trpc/init';
import { createContext } from '../trpc/context';
import { createLogger } from '../util/logger';
import {
  SNOWLUMA_IPC_CHANNEL,
  type IpcTrpcRequest,
  type IpcTrpcResponse,
} from '@shared/ipc-protocol';

const log = createLogger('ipc');

/**
 * Minimal tRPC-over-IPC bridge written specifically against tRPC v11.
 *
 * Why not electron-trpc: 0.7.1 was built for tRPC v10's router shape
 * (`getErrorShape` on the router, different `_def` layout). Loading our
 * v11 router through it explodes at first request with
 * `n.getErrorShape is not a function`.
 *
 * Wire format (see `@shared/ipc-protocol`):
 *   renderer ipcRenderer.invoke(CHANNEL, { path, type, input })
 *     → main calls the procedure via the v11 caller factory
 *     → returns `{ ok: true, data }` or `{ ok: false, error: {...} }`
 *
 * Subscriptions are not yet supported (we don't use any) — the type
 * field is preserved in the request so we can add them later by
 * negotiating a per-subscription channel.
 */
const callerFactory = createCallerFactory(appRouter);

export function attachTrpcBridge(_windows: BrowserWindow[]): void {
  // `BrowserWindow[]` arg kept for API parity; we use ipcMain.handle
  // which routes per-event regardless of window count.
  void _windows;
  ipcMain.removeHandler(SNOWLUMA_IPC_CHANNEL);
  ipcMain.handle(SNOWLUMA_IPC_CHANNEL, async (_event, raw: unknown): Promise<IpcTrpcResponse> => {
    if (!isRequest(raw)) {
      return errorResponse(new TRPCError({ code: 'BAD_REQUEST', message: 'invalid ipc request shape' }), '');
    }
    const req = raw;
    if (req.type === 'subscription') {
      return errorResponse(
        new TRPCError({ code: 'METHOD_NOT_SUPPORTED', message: 'subscriptions are not yet wired in IPC' }),
        req.path,
      );
    }
    try {
      const caller = callerFactory(createContext()) as Record<string, unknown>;
      const fn = walkPath(caller, req.path);
      if (typeof fn !== 'function') {
        throw new TRPCError({ code: 'NOT_FOUND', message: `procedure not found: ${req.path}` });
      }
      const data = await (fn as (input: unknown) => unknown | Promise<unknown>)(req.input);
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
  return typeof v.path === 'string' && (v.type === 'query' || v.type === 'mutation' || v.type === 'subscription');
}

/** Walk a dotted procedure path: 'app.prefs.get' -> caller.app.prefs.get. */
function walkPath(root: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((cursor, segment) => {
    if (cursor && typeof cursor === 'object' && segment in cursor) {
      return (cursor as Record<string, unknown>)[segment];
    }
    return undefined;
  }, root);
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
