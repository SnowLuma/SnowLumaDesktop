/**
 * Shape of every tRPC-over-IPC request / response.
 * Lives in `src/shared/` so both main and renderer import the same types.
 */

export const SNOWLUMA_IPC_CHANNEL = 'snowluma:trpc';
/**
 * Push channel for progress / status events from the main process. We
 * use it for download progress (and any future long-running task that
 * wants real-time updates without the renderer polling).
 *
 * Polling was explicitly off-limits per the project brief — this is
 * the alternative: main `webContents.send(EVENT_CHANNEL, { kind, ... })`,
 * renderer subscribes via `window.snowlumaIpc.onEvent(...)`.
 */
export const SNOWLUMA_EVENT_CHANNEL = 'snowluma:event';
/**
 * Fire-and-forget command channel for our custom titlebar. The
 * renderer triggers window controls (minimize / maximize / close) via
 * `ipcRenderer.send(...)`. We deliberately don't expose
 * `BrowserWindow` to the renderer; preload narrows this to a small
 * union.
 */
export const SNOWLUMA_WINDOW_CMD_CHANNEL = 'snowluma:window-cmd';

export type SnowlumaWindowCmd = 'minimize' | 'toggle-maximize' | 'close';

export interface IpcTrpcRequest {
  path: string;
  type: 'query' | 'mutation' | 'subscription';
  input: unknown;
}

export type IpcTrpcResponse =
  | { ok: true; data: unknown }
  | {
      ok: false;
      error: {
        message: string;
        code?: string;
        httpStatus?: number;
        path?: string;
        cause?: string;
      };
    };

/**
 * Discriminated union of every push event main → renderer.
 *
 * `download:progress` fires repeatedly while a core / desktop artifact
 * is downloading. The `id` field lets the UI scope listeners to the
 * specific download it kicked off (we use `core:<version>` for core
 * versions; future use can pick other shapes).
 */
export type SnowlumaPushEvent =
  | {
      kind: 'download:progress';
      id: string;
      bytesDone: number;
      bytesTotal: number | null;
      speedBytesPerSec: number;
      mirrorId: string;
      attempt: number;
    }
  | {
      kind: 'download:done';
      id: string;
      bytesTotal: number;
    }
  | {
      kind: 'download:error';
      id: string;
      message: string;
    }
  | {
      kind: 'window:state';
      maximized: boolean;
      focused: boolean;
    };

declare global {
  interface Window {
    snowlumaIpc: {
      request(req: IpcTrpcRequest): Promise<IpcTrpcResponse>;
      onEvent(listener: (event: SnowlumaPushEvent) => void): () => void;
      window: {
        send(cmd: SnowlumaWindowCmd): void;
      };
    };
  }
}
