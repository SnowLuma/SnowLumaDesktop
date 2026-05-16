import { app } from 'electron';
import { autoUpdater, type UpdateCheckResult } from 'electron-updater';
import { createLogger } from '../util/logger';
import { getStore } from '../store/store';

const log = createLogger('updater');

export interface DesktopUpdateInfo {
  available: boolean;
  channel: 'main' | 'dev';
  currentVersion: string;
  latestVersion: string | null;
  releaseNotes: string | null;
  releaseDate: string | null;
}

/**
 * Wraps electron-updater. Policy (7a-iii): notify only — never auto-download.
 * Caller triggers `download()` after user confirms. main vs dev (13d): main
 * uses GH Releases stable; dev opts into prereleases.
 */
export class DesktopUpdater {
  private initialised = false;

  constructor() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.logger = {
      info: (m: unknown) => log.info(String(m)),
      warn: (m: unknown) => log.warn(String(m)),
      error: (m: unknown) => log.error(String(m)),
      debug: (m: unknown) => log.debug(String(m)),
    };
  }

  init(): void {
    if (this.initialised) return;
    this.initialised = true;
    const channel = getStore().get('updateChannel');
    autoUpdater.allowPrerelease = channel === 'dev';
    log.info(`updater initialised, channel=${channel}`);
  }

  async check(): Promise<DesktopUpdateInfo> {
    this.init();
    const channel = getStore().get('updateChannel');
    autoUpdater.allowPrerelease = channel === 'dev';
    const current = app.getVersion();
    if (!app.isPackaged) {
      log.debug('updater check skipped in unpackaged dev build');
      return {
        available: false,
        channel,
        currentVersion: current,
        latestVersion: null,
        releaseNotes: null,
        releaseDate: null,
      };
    }
    try {
      const result: UpdateCheckResult | null = await autoUpdater.checkForUpdates();
      if (!result || !result.updateInfo) {
        return {
          available: false,
          channel,
          currentVersion: current,
          latestVersion: null,
          releaseNotes: null,
          releaseDate: null,
        };
      }
      const remote = result.updateInfo.version;
      return {
        available: compareVersions(remote, current) > 0,
        channel,
        currentVersion: current,
        latestVersion: remote,
        releaseNotes:
          typeof result.updateInfo.releaseNotes === 'string'
            ? result.updateInfo.releaseNotes
            : null,
        releaseDate: result.updateInfo.releaseDate ?? null,
      };
    } catch (err) {
      log.warn(`update check failed: ${err instanceof Error ? err.message : String(err)}`);
      return {
        available: false,
        channel,
        currentVersion: current,
        latestVersion: null,
        releaseNotes: null,
        releaseDate: null,
      };
    }
  }

  async download(): Promise<void> {
    this.init();
    await autoUpdater.downloadUpdate();
  }

  quitAndInstall(): void {
    autoUpdater.quitAndInstall();
  }

  setChannel(channel: 'main' | 'dev'): void {
    getStore().set('updateChannel', channel);
    autoUpdater.allowPrerelease = channel === 'dev';
  }
}

/** Lightweight semver-ish compare returning -1/0/1. */
function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split(/[.\-+]/);
  const pb = b.replace(/^v/, '').split(/[.\-+]/);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const ai = pa[i] ?? '0';
    const bi = pb[i] ?? '0';
    const an = Number(ai);
    const bn = Number(bi);
    if (Number.isFinite(an) && Number.isFinite(bn)) {
      if (an < bn) return -1;
      if (an > bn) return 1;
    } else if (ai < bi) {
      return -1;
    } else if (ai > bi) {
      return 1;
    }
  }
  return 0;
}
