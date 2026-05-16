import { vi } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Stub Electron's main-process API surface enough that pure-logic
 * modules can transitively import from `electron` without paying the
 * cost of loading the real binary in tests.
 */
const userDataDir = join(tmpdir(), 'snowluma-desktop-test');

vi.mock('electron', () => {
  return {
    app: {
      getPath: (name: string) => {
        if (name === 'userData') return userDataDir;
        if (name === 'temp') return tmpdir();
        if (name === 'logs') return join(userDataDir, 'logs');
        return userDataDir;
      },
      getVersion: () => '0.0.0-test',
      getName: () => 'snowluma-desktop',
      getAppPath: () => userDataDir,
      isPackaged: false,
      isReady: () => true,
      whenReady: () => Promise.resolve(),
      on: vi.fn(),
      once: vi.fn(),
      off: vi.fn(),
    },
    dialog: {
      showSaveDialog: vi.fn(() => Promise.resolve({ filePath: undefined })),
      showMessageBox: vi.fn(() => Promise.resolve({ response: 0 })),
    },
    shell: { openExternal: vi.fn(), openPath: vi.fn() },
    BrowserWindow: vi.fn(),
    Tray: vi.fn(),
    Menu: { buildFromTemplate: vi.fn() },
    nativeImage: { createEmpty: vi.fn() },
    ipcMain: { on: vi.fn(), handle: vi.fn(), removeHandler: vi.fn() },
  };
});

vi.mock('electron-store', () => {
  class MemoryStore {
    private readonly data = new Map<string, unknown>();
    constructor(opts?: { defaults?: Record<string, unknown> }) {
      if (opts?.defaults) {
        for (const [k, v] of Object.entries(opts.defaults)) this.data.set(k, v);
      }
    }
    get(key: string) {
      return this.data.get(key);
    }
    set(key: string, value: unknown) {
      this.data.set(key, value);
    }
    delete(key: string) {
      this.data.delete(key);
    }
    clear() {
      this.data.clear();
    }
  }
  return { default: MemoryStore };
});

vi.mock('electron-updater', () => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    allowPrerelease: false,
    logger: null,
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
  },
}));

vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true },
  electronApp: { setAppUserModelId: vi.fn() },
  optimizer: { watchWindowShortcuts: vi.fn() },
}));
