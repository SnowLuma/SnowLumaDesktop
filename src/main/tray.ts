import { Tray, Menu, nativeImage, app, BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import { createLogger } from './util/logger';
import { getStore } from './store/store';
import { getServices } from './services';
import { applyAutostartPreference } from './services/autostart';

const log = createLogger('tray');

let tray: Tray | null = null;
let refreshInterval: NodeJS.Timeout | null = null;

const BOT_INLINE_THRESHOLD = 3; // 11b: >3 bots collapse into submenu

interface TrayDeps {
  getMainWindow(): BrowserWindow | null;
  confirmQuit(): Promise<boolean>;
}

export function createTray(deps: TrayDeps): Tray {
  if (tray) return tray;
  tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip('SnowLuma Desktop');
  rebuildMenu(deps);

  tray.on('double-click', () => {
    const win = deps.getMainWindow();
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });

  const services = getServices();
  services.bots.on('state', () => rebuildMenu(deps));
  services.core.on('state', () => rebuildMenu(deps));
  refreshInterval = setInterval(() => rebuildMenu(deps), 5_000);

  log.info('tray initialised');
  return tray;
}

export function destroyTray(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
  if (!tray) return;
  tray.destroy();
  tray = null;
}

function rebuildMenu(deps: TrayDeps): void {
  if (!tray) return;
  const store = getStore();
  const services = getServices();
  const records = services.bots.listBots();
  const states = new Map(services.bots.getStates().map((s) => [s.uin, s]));
  const coreState = services.core.getState();
  const autostartEnabled = store.get('autostartEnabled');

  const botItems: MenuItemConstructorOptions[] = records.map((r) => {
    const state = states.get(r.uin);
    const name = r.customName || r.uin;
    return {
      label: `${statusEmoji(state?.status)}  ${name}`,
      sublabel: r.uin,
      submenu: [
        { label: 'Bot ' + r.uin, enabled: false },
        ...(state?.status === 'online' || state?.status === 'awaiting-login' || state?.status === 'launching-qq'
          ? [{ label: '暂停', click: () => void services.bots.stop(r.uin) }]
          : []),
        { label: '启动', click: () => void services.bots.start(r.uin) },
        { label: '重启', click: () => void restartBot(r.uin) },
        { type: 'separator' as const },
        {
          label: '打开 webui',
          click: async () => {
            const win = deps.getMainWindow();
            if (win) {
              win.webContents.send('navigate-to-bot', r.uin);
              win.show();
              win.focus();
            }
          },
        },
      ],
    };
  });

  const botSection: MenuItemConstructorOptions[] =
    records.length === 0
      ? [{ label: '尚未添加 Bot', enabled: false }]
      : records.length <= BOT_INLINE_THRESHOLD
        ? botItems
        : [
            {
              label: `Bot 列表 (${records.length})`,
              submenu: botItems,
            },
          ];

  const template: MenuItemConstructorOptions[] = [
    {
      label: '显示主窗口',
      click: () => {
        const win = deps.getMainWindow();
        if (!win) return;
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
      },
    },
    { type: 'separator' },
    {
      label: `core: ${coreStatusLabel(coreState.status)}${coreState.activeVersion ? ` (${coreState.activeVersion})` : ''}`,
      enabled: false,
    },
    ...botSection,
    {
      label: '➕ 添加 Bot',
      click: () => {
        const win = deps.getMainWindow();
        if (!win) return;
        win.show();
        win.focus();
        win.webContents.send('navigate-add-bot');
      },
    },
    { type: 'separator' },
    {
      label: '检查更新…',
      click: async () => {
        const win = deps.getMainWindow();
        if (win) {
          win.webContents.send('navigate-check-update');
          win.show();
        }
      },
    },
    { label: '打开日志目录', click: () => openLogsFolder() },
    {
      label: '开机自启',
      type: 'checkbox',
      checked: autostartEnabled,
      click: (item) => {
        store.set('autostartEnabled', item.checked);
        applyAutostartPreference();
      },
    },
    { type: 'separator' },
    {
      label: '⏻ 退出',
      click: async () => {
        const ok = await deps.confirmQuit();
        if (ok) app.exit(0);
      },
    },
  ];

  tray.setContextMenu(Menu.buildFromTemplate(template));
}

function statusEmoji(status: string | undefined): string {
  switch (status) {
    case 'online':
      return '🟢';
    case 'awaiting-login':
    case 'launching-qq':
    case 'reconnecting':
      return '🟡';
    case 'needs-attention':
      return '⚠️';
    case 'user-managed':
      return '👤';
    default:
      return '⚪';
  }
}

function coreStatusLabel(status: string): string {
  switch (status) {
    case 'stopped':
      return '已停止';
    case 'starting':
      return '启动中…';
    case 'running':
      return '运行中';
    case 'crashed':
      return '已崩溃';
    case 'restarting':
      return '重启中…';
    case 'no-version-active':
      return '未选定版本';
    default:
      return status;
  }
}

async function restartBot(uin: string): Promise<void> {
  const services = getServices();
  await services.bots.stop(uin);
  await services.bots.start(uin);
}

function openLogsFolder(): void {
  const { shell } = require('electron') as typeof import('electron');
  const { desktopLogsDir } = require('./util/paths') as typeof import('./util/paths');
  void shell.openPath(desktopLogsDir());
}
