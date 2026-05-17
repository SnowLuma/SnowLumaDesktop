import { contextBridge, ipcRenderer } from 'electron';
import {
  SNOWLUMA_IPC_CHANNEL,
  SNOWLUMA_EVENT_CHANNEL,
  type IpcTrpcRequest,
  type IpcTrpcResponse,
  type SnowlumaPushEvent,
} from '@shared/ipc-protocol';

/**
 * Preload bridge. With contextIsolation enabled, the renderer can't
 * touch ipcRenderer directly — we expose a typed narrow surface here.
 *
 *  - `request`: forward a tRPC operation and await the response.
 *  - `onEvent`: subscribe to push events from main (download progress,
 *    etc.). Returns a dispose function that removes the listener. We
 *    keep the surface strictly listen-only — the renderer can't send
 *    arbitrary IPC.
 */
contextBridge.exposeInMainWorld('snowlumaIpc', {
  request: (req: IpcTrpcRequest): Promise<IpcTrpcResponse> =>
    ipcRenderer.invoke(SNOWLUMA_IPC_CHANNEL, req),
  onEvent: (listener: (event: SnowlumaPushEvent) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, payload: SnowlumaPushEvent) => {
      try {
        listener(payload);
      } catch {
        /* swallow — never let a renderer-side listener crash the bridge */
      }
    };
    ipcRenderer.on(SNOWLUMA_EVENT_CHANNEL, handler);
    return () => ipcRenderer.removeListener(SNOWLUMA_EVENT_CHANNEL, handler);
  },
});
