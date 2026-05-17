import { BrowserWindow, app, shell, ipcMain } from 'electron';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { is } from '@electron-toolkit/utils';
import { createLogger } from './util/logger';
import {
  SNOWLUMA_WINDOW_CMD_CHANNEL,
  type SnowlumaWindowCmd,
} from '@shared/ipc-protocol';
import { broadcastEvent } from './ipc/event-bus';

const log = createLogger('window');

interface CreateMainWindowOptions {
  /** When true, create the window but don't show it (autostart-to-tray). */
  startHidden?: boolean;
  /** Invoked when the close button is pressed (frameless mode). Allows
   *  main to decide between hide-to-tray and quit. Defaults to hide. */
  onCloseRequest?: (win: BrowserWindow) => void;
}

// Default app icon path inside the packaged build. electron-builder
// copies `build/icon.png` into resources/, and we ask for it explicitly
// so Windows shows the right glyph in the taskbar / Alt-Tab dialog.
function appIconPath(): string | undefined {
  const candidates = [
    join(process.resourcesPath, 'icon.png'),
    join(__dirname, '../../build/icon.png'),
    join(__dirname, '../../../build/icon.png'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return undefined;
}

export function createMainWindow(opts: CreateMainWindowOptions = {}): BrowserWindow {
  const preloadPath = join(__dirname, '../preload/index.cjs');
  const rendererPath = join(__dirname, '../renderer/index.html');
  const iconPath = appIconPath();

  log.info(`creating main window. preload=${preloadPath} exists=${existsSync(preloadPath)}`);
  log.info(`renderer html=${rendererPath} exists=${existsSync(rendererPath)}`);
  log.info(`icon=${iconPath ?? '<missing>'}, startHidden=${!!opts.startHidden}, packaged=${app.isPackaged}, dev=${is.dev}`);

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    // Frameless: we draw our own titlebar in the renderer. Buttons live
    // there and route through the SNOWLUMA_WINDOW_CMD_CHANNEL below.
    // The drag region is set via CSS `-webkit-app-region: drag` on the
    // titlebar container.
    frame: false,
    // Show immediately. The "show: false + ready-to-show" pattern is
    // nice for hiding the white flash, but if the renderer fails to
    // load (no first paint), ready-to-show NEVER fires and the window
    // stays invisible forever — exactly the bug we just fixed on
    // Windows portable. The flash isn't worth the risk.
    show: !opts.startHidden,
    center: true,
    skipTaskbar: false,
    autoHideMenuBar: true,
    title: 'SnowLumaDesktop',
    icon: iconPath,
    backgroundColor: '#0b1220',
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true,
    },
  });

  // The OS-level "title" is still read by some screen readers and the
  // Task Manager fallback when no productName is configured. Belt-and-
  // braces; the value should already match electron-builder.yml.
  win.setTitle('SnowLumaDesktop');

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

  // Push window-state events so our custom titlebar can re-render the
  // maximize / restore glyph and dim the controls when blurred.
  const pushState = () => {
    if (win.isDestroyed()) return;
    broadcastEvent({
      kind: 'window:state',
      maximized: win.isMaximized(),
      focused: win.isFocused(),
    });
  };
  win.on('maximize', pushState);
  win.on('unmaximize', pushState);
  win.on('focus', pushState);
  win.on('blur', pushState);
  // Emit once after the renderer is alive so the titlebar paints with
  // the correct initial state instead of guessing.
  win.webContents.once('did-finish-load', pushState);

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

  // Wire the titlebar command channel. We register the listener per-
  // window so destroyed windows stop receiving commands automatically
  // (and so a hot-reloaded dev session doesn't accumulate handlers).
  const onWindowCmd = (event: Electron.IpcMainEvent, cmd: SnowlumaWindowCmd) => {
    if (event.sender.id !== win.webContents.id) return;
    if (win.isDestroyed()) return;
    if (cmd === 'minimize') {
      win.minimize();
    } else if (cmd === 'toggle-maximize') {
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
    } else if (cmd === 'close') {
      // Default: hide to tray. Delegate the policy decision to the
      // caller via onCloseRequest so main can swap in "really quit"
      // when needed.
      if (opts.onCloseRequest) opts.onCloseRequest(win);
      else win.hide();
    }
  };
  ipcMain.on(SNOWLUMA_WINDOW_CMD_CHANNEL, onWindowCmd);
  win.on('closed', () => {
    ipcMain.removeListener(SNOWLUMA_WINDOW_CMD_CHANNEL, onWindowCmd);
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
