import { exposeElectronTRPC } from 'electron-trpc/main';

/**
 * Preload script. Runs in an isolated context but with access to Node APIs.
 * We expose only the tRPC IPC channel — renderer talks to main via tRPC,
 * never via raw ipcRenderer.
 */
process.once('loaded', () => {
  exposeElectronTRPC();
});
