import { contextBridge, ipcRenderer } from 'electron';
import {
  SNOWLUMA_IPC_CHANNEL,
  SNOWLUMA_EVENT_CHANNEL,
  SNOWLUMA_WINDOW_CMD_CHANNEL,
  type IpcTrpcRequest,
  type IpcTrpcResponse,
  type SnowlumaPushEvent,
  type SnowlumaWindowCmd,
} from '@shared/ipc-protocol';

/**
 * Preload bridge. With contextIsolation enabled, the renderer can't
 * touch ipcRenderer directly — we expose a typed narrow surface here.
 *
 *  - `request`: forward a tRPC operation and await the response.
 *  - `onEvent`: subscribe to push events from main (download progress,
 *    window state, etc.). Returns a dispose function. Listen-only.
 *  - `window.send`: fire a window-control command (minimize /
 *    toggle-maximize / close). Main handles the actual BrowserWindow
 *    method calls — the renderer never sees the BrowserWindow object.
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
  window: {
    send: (cmd: SnowlumaWindowCmd): void => {
      ipcRenderer.send(SNOWLUMA_WINDOW_CMD_CHANNEL, cmd);
    },
  },
});
