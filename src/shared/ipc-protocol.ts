/**
 * Shape of every tRPC-over-IPC request / response.
 * Lives in `src/shared/` so both main and renderer import the same types.
 */

export const SNOWLUMA_IPC_CHANNEL = 'snowluma:trpc';

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

declare global {
  interface Window {
    snowlumaIpc: {
      request(req: IpcTrpcRequest): Promise<IpcTrpcResponse>;
    };
  }
}
