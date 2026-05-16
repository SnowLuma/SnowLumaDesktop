import { createIPCHandler } from 'electron-trpc/main';
import type { BrowserWindow } from 'electron';
import { appRouter } from '../trpc/router';
import { createContext } from '../trpc/context';

export function attachTrpcBridge(windows: BrowserWindow[]): void {
  createIPCHandler({
    router: appRouter,
    windows,
    createContext: async () => createContext(),
  });
}
