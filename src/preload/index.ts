import { contextBridge, ipcRenderer } from 'electron';
import {
  SNOWLUMA_IPC_CHANNEL,
  type IpcTrpcRequest,
  type IpcTrpcResponse,
} from '@shared/ipc-protocol';

/**
 * Preload bridge. With contextIsolation enabled, the renderer can't
 * touch ipcRenderer directly — we expose a typed narrow surface here.
 * Single method: forward a tRPC operation and await the response.
 */
contextBridge.exposeInMainWorld('snowlumaIpc', {
  request: (req: IpcTrpcRequest): Promise<IpcTrpcResponse> =>
    ipcRenderer.invoke(SNOWLUMA_IPC_CHANNEL, req),
});
