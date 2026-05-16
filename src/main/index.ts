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
import { getStore } from './store/store';

const log = createLogger('main');

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

  app.whenReady().then(() => {
    electronApp.setAppUserModelId(`com.snowluma.${APP_NAME.toLowerCase()}`);

    app.on('browser-window-created', (_event, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    const services = initServices();

    mainWindow = createMainWindow();
    attachTrpcBridge([mainWindow]);

    // 11c · close-to-tray: hide instead of destroy on user X-click. Only a
    // real Quit (tray menu → 退出, or app.exit) closes the window.
    mainWindow.on('close', async (event) => {
      if (isQuitting) return;
      event.preventDefault();
      mainWindow?.hide();
      const store = getStore();
      if (!store.get('trayHintShown')) {
        store.set('trayHintShown', true);
        // 11c i: first-time toast hint. We pop a native modal (rare event,
        // worth being obvious) but only the first time.
        await dialog.showMessageBox({
          type: 'info',
          title: 'SnowLuma 仍在后台运行',
          message: '关闭主窗口不会真正退出 SnowLuma。',
          detail: '右键托盘 → "⏻ 退出" 可彻底停止所有 Bot 和 core 进程。',
          buttons: ['好的'],
        });
      }
    });

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
          title: '退出 SnowLuma Desktop',
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

    // Apply OS-level autostart preference based on persisted setting.
    applyAutostartPreference();

    // Autostart was launched but user prefers silent tray: hide initial window.
    if (wasLaunchedHidden()) {
      mainWindow?.once('ready-to-show', () => mainWindow?.hide());
    }

    void cleanupOldTrash(30_000); // sweep stale trash > 30s old (5s undo + slack)
    void services.core.start();   // resume core if a version is active

    log.info('app ready');

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow();
      } else {
        mainWindow?.show();
      }
    });
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
    // platform convention (irrelevant for Desktop's win32-only target,
    // but harmless to leave in for dev).
  });
}
