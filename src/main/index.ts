import { app, BrowserWindow, dialog } from 'electron';
import { electronApp, optimizer } from '@electron-toolkit/utils';
import { APP_NAME } from '@shared/constants';
import { createMainWindow } from './window';
import { attachTrpcBridge } from './ipc/bridge';
import { createTray, destroyTray } from './tray';
import { createLogger } from './util/logger';
import { initServices } from './services';
import { applyAutostartPreference, wasLaunchedHidden } from './services/autostart';
import { cleanupOldTrash } from './services/bot-manager';

// Force the process name BEFORE app.whenReady so Task Manager shows
// "SnowLumaDesktop" instead of the generic "Electron" / "snowluma-desktop"
// the npm package name would give us. `app.setName` also feeds into
// `app.getPath('userData')` etc — keep it identical to the productName
// in electron-builder.yml so userData paths don't shift between dev and
// packaged runs.
app.setName('SnowLumaDesktop');

const log = createLogger('main');

// Catch anything that escapes whenReady — packaged Electron just exits
// silently on unhandled errors otherwise, leaving "3 processes but no
// window" hangs with no log trail.
process.on('uncaughtException', (err) => {
  log.error(`uncaughtException: ${err.message}\n${err.stack ?? ''}`);
});
process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? `${reason.message}\n${reason.stack ?? ''}` : String(reason);
  log.error(`unhandledRejection: ${msg}`);
});

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

// 11a · single-instance lock. Forward second-launch args to the first.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  log.warn('another instance already running; exiting');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(bootstrap, (err) => {
    log.error(`whenReady rejected: ${err instanceof Error ? err.message : String(err)}`);
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.on('will-quit', () => {
    destroyTray();
  });

  app.on('window-all-closed', () => {
    // 5b · do NOT auto-quit on Windows; tray keeps the app alive until
    // a Quit is explicitly requested. macOS: keep the dock entry per
    // platform convention.
  });
}

async function bootstrap(): Promise<void> {
  log.info(
    `bootstrap start. electron=${process.versions.electron} chrome=${process.versions.chrome} node=${process.versions.node} platform=${process.platform} arch=${process.arch} packaged=${app.isPackaged}`,
  );

  electronApp.setAppUserModelId(`com.snowluma.${APP_NAME.toLowerCase()}`);

  app.on('browser-window-created', (_event, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // Phase 1: services + IPC bridge FIRST.
  // The renderer fires its first tRPC call from the router's beforeLoad
  // basically as soon as the React tree mounts. If `attachTrpcBridge`
  // hasn't registered the ipcMain handler by then, the invoke fails
  // with "No handler registered" and the router falls back — which
  // looks like "skips the wizard" to the user.
  let services: ReturnType<typeof initServices>;
  try {
    services = initServices();
  } catch (err) {
    log.error(`initServices threw: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  try {
    attachTrpcBridge([]);
  } catch (err) {
    log.error(`attachTrpcBridge threw: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Phase 2: only NOW open the window. The renderer's first IPC call
  // will land on a registered handler.
  const startHidden = wasLaunchedHidden();
  log.info(`wasLaunchedHidden=${startHidden} argv=${JSON.stringify(process.argv)}`);

  try {
    mainWindow = createMainWindow({
      startHidden,
      // Custom titlebar's close button routes through this. We hide-to-
      // tray silently — the titlebar tooltip already tells the user
      // what's happening, so the native popup we used to show here is
      // gone. Tray right-click → 退出 is still the way to actually quit.
      onCloseRequest: (win) => {
        if (isQuitting) {
          win.close();
        } else {
          win.hide();
        }
      },
    });
  } catch (err) {
    log.error(`createMainWindow threw: ${err instanceof Error ? err.message : String(err)}`);
    await dialog.showErrorBox(
      'SnowLumaDesktop 启动失败',
      `无法创建主窗口：${err instanceof Error ? err.message : String(err)}`,
    );
    app.exit(1);
    return;
  }

  // Keep the OS-level close (Alt-F4, taskbar right-click → close) doing
  // the same hide-to-tray dance. `isQuitting` is flipped to true by the
  // tray's "退出" menu and by `before-quit`.
  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow?.hide();
  });

  // Phase 3: tray. Failing to build the tray must NOT kill the window.
  try {
    createTray({
      getMainWindow: () => mainWindow,
      confirmQuit: async () => {
        const states = services.bots.getStates();
        const onlineCount = states.filter((s) => s.status === 'online').length;
        if (onlineCount === 0) {
          isQuitting = true;
          return true;
        }
        const choice = await dialog.showMessageBox({
          type: 'warning',
          title: '退出 SnowLumaDesktop',
          message: `当前有 ${onlineCount} 个 Bot 在线`,
          detail: '退出会停止所有 Bot 与 QQ 进程。确定继续吗？',
          buttons: ['取消', '全部停止并退出'],
          cancelId: 0,
          defaultId: 0,
        });
        if (choice.response === 1) {
          isQuitting = true;
          await services.bots.stopAll();
          await services.core.stop();
          return true;
        }
        return false;
      },
    });
  } catch (err) {
    log.error(`createTray threw (continuing): ${err instanceof Error ? err.message : String(err)}`);
  }

  // Phase 4: best-effort housekeeping.
  try {
    applyAutostartPreference();
  } catch (err) {
    log.warn(`applyAutostartPreference: ${err instanceof Error ? err.message : String(err)}`);
  }

  void cleanupOldTrash(30_000).catch((err) =>
    log.warn(`cleanupOldTrash: ${err instanceof Error ? err.message : String(err)}`),
  );

  void services.core.start().catch((err) =>
    log.warn(`core start: ${err instanceof Error ? err.message : String(err)}`),
  );

  log.info('app ready');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      try {
        mainWindow = createMainWindow();
      } catch (err) {
        log.error(`createMainWindow on activate threw: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      mainWindow?.show();
    }
  });
}
