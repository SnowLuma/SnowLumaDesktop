/**
 * electron-trpc injects its IPC client onto `window.electronTRPC` for the
 * renderer-side `ipcLink({ ... })` to consume. We don't expose anything
 * else from preload — keep the surface area minimal.
 */
declare global {
  interface Window {
    electronTRPC: {
      sendMessage: (operation: unknown) => void;
    };
  }
}

export {};
