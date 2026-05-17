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
 *
 * Quirk we worked around: when only prereleases exist on the GitHub
 * repo (the current SnowLumaDesktop state — we publish nightlies, no
 * stable yet), electron-updater hits /releases/latest, GitHub returns
 * 406, and the library blows up with a 100-line "Cannot parse releases
 * feed" error. We:
 *   1. Always set `allowPrerelease = true` so the atom-feed code path
 *      is used. The user's channel preference becomes a UI filter, not
 *      a hard switch.
 *   2. Demote the "no production release found" error in our wrapper
 *      to a clean no-update response.
 *   3. Pipe electron-updater's noisy errors through our logger at
 *      WARN level so the diagnostic export doesn't get spammed.
 */
export class DesktopUpdater {
  private initialised = false;

  constructor() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.logger = {
      info: (m: unknown) => log.info(String(m)),
      warn: (m: unknown) => log.warn(String(m)),
      // electron-updater logs the full HTTP failure object at error level
      // even when we catch it. Downgrade to warn so diagnostic exports
      // don't include screen-fulls of GitHub CSP headers.
      error: (m: unknown) => log.warn(String(m)),
      debug: (m: unknown) => log.debug(String(m)),
    };
  }

  init(): void {
    if (this.initialised) return;
    this.initialised = true;
    // Always allow prereleases. We filter client-side based on channel
    // preference rather than relying on electron-updater's main-only
    // /releases/latest path (which 406s when no stable release exists).
    autoUpdater.allowPrerelease = true;
    const channel = getStore().get('updateChannel');
    log.info(`updater initialised, channel=${channel} (allowPrerelease forced on)`);
  }

  async check(): Promise<DesktopUpdateInfo> {
    this.init();
    const channel = getStore().get('updateChannel');
    autoUpdater.allowPrerelease = true;
    const current = app.getVersion();
    if (!app.isPackaged) {
      log.debug('updater check skipped in unpackaged dev build');
      return noUpdate(channel, current);
    }
    try {
      const result: UpdateCheckResult | null = await autoUpdater.checkForUpdates();
      if (!result || !result.updateInfo) {
        return noUpdate(channel, current);
      }
      const remote = result.updateInfo.version;
      const isPrerelease = looksLikePrerelease(remote);
      // On the `main` channel, surface only true production releases.
      // We still query the prerelease-aware atom feed (otherwise we'd
      // hit /releases/latest and 406 on repos that have no stable yet),
      // then filter here.
      if (channel === 'main' && isPrerelease) {
        log.info(
          `updater: latest is prerelease ${remote}; user is on main channel — reporting no-update`,
        );
        return noUpdate(channel, current);
      }
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
      const message = err instanceof Error ? err.message : String(err);
      // Quietly suppress the "no production release" failure shape —
      // it's the expected state for a brand-new repo with only nightly
      // tags, and not actionable for the user. Anything else gets a
      // single warn line (no stack trace dump).
      if (
        /Unable to find latest version on GitHub/.test(message) ||
        /Cannot find latest.yml/.test(message) ||
        /HttpError: 404/.test(message)
      ) {
        log.info(`updater: no release feed available (treating as no-update)`);
      } else {
        log.warn(`updater check failed: ${message.split('\n')[0] ?? message}`);
      }
      return noUpdate(channel, current);
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
    // Keep allowPrerelease=true unconditionally; channel is now a
    // post-fetch filter (see `check`).
    autoUpdater.allowPrerelease = true;
  }
}

function noUpdate(channel: 'main' | 'dev', current: string): DesktopUpdateInfo {
  return {
    available: false,
    channel,
    currentVersion: current,
    latestVersion: null,
    releaseNotes: null,
    releaseDate: null,
  };
}

/**
 * Heuristic prerelease detector: semver pre-identifier (`-dev`, `-rc`,
 * `-beta`, …) or our own `nightly-*` tag prefix.
 */
function looksLikePrerelease(version: string): boolean {
  const v = version.toLowerCase();
  if (v.startsWith('nightly-')) return true;
  return /[-+](?:dev|alpha|beta|rc|next|nightly|preview|pre)\b/.test(v);
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
