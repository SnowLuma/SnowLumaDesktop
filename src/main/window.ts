import { BrowserWindow, app, shell } from 'electron';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { is } from '@electron-toolkit/utils';
import { createLogger } from './util/logger';

const log = createLogger('window');

interface CreateMainWindowOptions {
  /** When true, create the window but don't show it (autostart-to-tray). */
  startHidden?: boolean;
}

export function createMainWindow(opts: CreateMainWindowOptions = {}): BrowserWindow {
  const preloadPath = join(__dirname, '../preload/index.cjs');
  const rendererPath = join(__dirname, '../renderer/index.html');

  log.info(`creating main window. preload=${preloadPath} exists=${existsSync(preloadPath)}`);
  log.info(`renderer html=${rendererPath} exists=${existsSync(rendererPath)}`);
  log.info(`startHidden=${!!opts.startHidden}, isPackaged=${app.isPackaged}, dev=${is.dev}`);

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    // Show immediately. The "show: false + ready-to-show" pattern is
    // nice for hiding the white flash, but if the renderer fails to
    // load (no first paint), ready-to-show NEVER fires and the window
    // stays invisible forever — exactly the bug we just fixed on
    // Windows portable. The flash isn't worth the risk.
    show: !opts.startHidden,
    center: true,
    skipTaskbar: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b1220',
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true,
    },
  });

  if (!opts.startHidden) {
    // Belt-and-suspenders: force focus right after construct. On some
    // Windows configs `show: true` puts the window in the taskbar but
    // doesn't bring it to the front.
    try {
      win.show();
      win.focus();
      win.moveTop();
    } catch (err) {
      log.warn(`initial show/focus failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Defensive: also show on ready-to-show. Cheap insurance — if the
  // window was already shown above, this is a no-op.
  win.once('ready-to-show', () => {
    if (!opts.startHidden && !win.isVisible()) win.show();
    log.info('window ready-to-show');
  });

  // Last-resort fallback: if ready-to-show hasn't fired in 5s, force
  // show anyway so the user sees SOMETHING (probably a half-painted page
  // they can refresh) instead of a phantom process.
  if (!opts.startHidden) {
    const fallback = setTimeout(() => {
      if (!win.isDestroyed() && !win.isVisible()) {
        log.warn('ready-to-show not fired after 5s, force-showing window');
        try { win.show(); } catch { /* destroyed */ }
      }
    }, 5_000);
    win.once('ready-to-show', () => clearTimeout(fallback));
    win.once('closed', () => clearTimeout(fallback));
  }

  // Diagnostics so a packaged build doesn't fail silently next time.
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    log.error(`did-fail-load code=${code} url=${url} desc=${desc}`);
    if (app.isPackaged && !win.isDestroyed()) {
      try { win.webContents.openDevTools({ mode: 'detach' }); } catch { /* ignore */ }
      try { win.show(); } catch { /* ignore */ }
    }
  });

  win.webContents.on('render-process-gone', (_e, details) => {
    log.error(`render-process-gone reason=${details.reason} exitCode=${details.exitCode}`);
    if (!win.isDestroyed()) {
      try { win.webContents.reload(); } catch { /* ignore */ }
    }
  });

  win.webContents.on('preload-error', (_e, path, err) => {
    log.error(`preload-error path=${path} err=${err.message}`);
  });

  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    // Mirror renderer console into the Desktop log so we can diagnose
    // packaged-only renderer errors after the fact.
    const tag = level >= 2 ? 'error' : level === 1 ? 'warn' : 'info';
    log[tag === 'error' ? 'error' : tag === 'warn' ? 'warn' : 'debug'](
      `renderer console [${tag}] ${message} (${sourceId}:${line})`,
    );
  });

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // Load the renderer.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    log.info(`loading dev renderer url=${process.env['ELECTRON_RENDERER_URL']}`);
    void win
      .loadURL(process.env['ELECTRON_RENDERER_URL'])
      .catch((err) => log.error(`loadURL failed: ${err instanceof Error ? err.message : String(err)}`));
  } else {
    log.info(`loading packaged renderer file=${rendererPath}`);
    void win
      .loadFile(rendererPath)
      .catch((err) => log.error(`loadFile failed: ${err instanceof Error ? err.message : String(err)}`));
  }

  return win;
}
