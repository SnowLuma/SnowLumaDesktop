import { app, shell } from 'electron';
import { createLogger } from '../util/logger';
import { getStore } from '../store/store';
import { listReleases, type GithubRelease } from './github-api';

const log = createLogger('updater');

const DESKTOP_OWNER = 'SnowLuma';
const DESKTOP_REPO = 'SnowLumaDesktop';

export interface DesktopUpdateInfo {
  available: boolean;
  channel: 'main' | 'dev';
  currentVersion: string;
  latestVersion: string | null;
  releaseNotes: string | null;
  releaseDate: string | null;
  /**
   * URL to the GitHub release page. We surface this for the "download"
   * action instead of trying to auto-install — current packaged builds
   * don't ship a `latest.yml`, so electron-updater can't perform the
   * actual upgrade. Until that lands, "Download" opens the release
   * page in the user's browser.
   */
  downloadUrl: string | null;
}

/**
 * Update checker for the Desktop app itself. We hit the public GitHub
 * REST API rather than `electron-updater.checkForUpdates()`:
 *   - REST returns prereleases without needing a `latest.yml` asset
 *     (which we don't publish in nightlies).
 *   - It surfaces a clean "no releases yet" state instead of the 100-
 *     line CSP-header dump the old code path produced.
 *   - It's also what the core-version picker uses, so one API call
 *     pattern across the app.
 *
 * Policy (7a-iii): notify only — never auto-download. The download()
 * call just opens the release page; users grab the .exe themselves.
 * Auto-install can come later once we ship a code-signed build + the
 * latest.yml feed that electron-updater wants.
 */
export class DesktopUpdater {
  async check(): Promise<DesktopUpdateInfo> {
    const channel = getStore().get('updateChannel');
    const current = app.getVersion();
    try {
      const all = await listReleases(DESKTOP_OWNER, DESKTOP_REPO);
      const visible = all.filter((r) => !r.draft);
      const pool = channel === 'main' ? visible.filter((r) => !r.prerelease) : visible;
      // GitHub's list is most-recent-first by published_at by default,
      // but we sort defensively so a draft / out-of-order tag doesn't
      // throw us off.
      pool.sort((a, b) => publishedAtMs(b) - publishedAtMs(a));
      const latest = pool[0];
      if (!latest) {
        log.info(
          `updater: no releases on ${channel} channel for ${DESKTOP_OWNER}/${DESKTOP_REPO} (visible=${visible.length})`,
        );
        return noUpdate(channel, current);
      }
      const remoteVersion = normaliseTag(latest.tagName);
      const available = compareVersions(remoteVersion, current) > 0;
      log.info(
        `updater: channel=${channel} current=${current} latest=${remoteVersion} available=${available}`,
      );
      return {
        available,
        channel,
        currentVersion: current,
        latestVersion: remoteVersion,
        releaseNotes: latest.body,
        releaseDate: latest.publishedAt,
        downloadUrl: latest.htmlUrl,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn(`updater check failed: ${message.split('\n')[0] ?? message}`);
      return noUpdate(channel, current);
    }
  }

  /**
   * "Download" opens the release page in the user's browser. We don't
   * ship a `latest.yml` so electron-updater can't auto-install; until
   * code-signing + that feed are in place this is the honest path.
   */
  async download(): Promise<void> {
    const info = await this.check();
    if (!info.downloadUrl) {
      log.warn('updater.download called without a known release URL');
      return;
    }
    await shell.openExternal(info.downloadUrl);
  }

  quitAndInstall(): void {
    // No-op until we wire actual electron-updater installs. Kept on the
    // procedure surface so the renderer's existing "重启并安装" button
    // doesn't blow up; it now just falls through silently.
    log.info('updater.quitAndInstall is a no-op until latest.yml is published');
  }

  setChannel(channel: 'main' | 'dev'): void {
    getStore().set('updateChannel', channel);
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
    downloadUrl: null,
  };
}

function publishedAtMs(r: GithubRelease): number {
  if (!r.publishedAt) return 0;
  const t = Date.parse(r.publishedAt);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Strip the leading `v` and any `nightly-` prefix so version comparison
 * works on consistent shapes. Our nightly tags look like
 * `nightly-<short-hash>` and our stable tags will look like `v1.8.1`.
 */
function normaliseTag(tag: string): string {
  return tag.replace(/^v/, '').replace(/^nightly-/, 'nightly.');
}

/**
 * Semver-ish compare returning -1/0/1. Treats numeric segments as
 * numbers and falls back to lexicographic comparison for non-numeric
 * tails (e.g. nightly hashes).
 */
function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.\-+]/);
  const pb = b.split(/[.\-+]/);
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
