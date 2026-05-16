import { fetchJson } from './download-manager';
import { createLogger } from '../util/logger';
import { getStore } from '../store/store';

const log = createLogger('qq-compat');

export interface QqCompatManifest {
  version: number;
  updatedAt?: string;
  policy: { allowUnknown: boolean; warnUnknown?: boolean };
  knownGoodVersions: Array<{ version: string; note?: string }>;
  knownBadVersions: Array<{ version: string; reason?: string; fixedInDesktopVersion?: string }>;
  minVersion: string | null;
  notes?: string[];
}

const DEFAULT_MANIFEST_URL =
  'https://raw.githubusercontent.com/SnowLuma/SnowLuma/main/compat/qq.json';

const CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

interface CachedManifest {
  manifest: QqCompatManifest;
  fetchedAt: number;
}

/**
 * Returns the QQ-version compatibility manifest. Cached for 3 days in
 * electron-store; refreshed lazily. Falls back to cached value when the
 * network is down so first-launch failures don't break the wizard.
 */
export async function getQqCompatManifest(opts: { forceRefresh?: boolean } = {}): Promise<QqCompatManifest> {
  const store = getStore() as unknown as { get(k: string): unknown; set(k: string, v: unknown): void };
  const cachedRaw = store.get('qqCompatCache') as CachedManifest | undefined;
  const fresh =
    !opts.forceRefresh && cachedRaw && Date.now() - cachedRaw.fetchedAt < CACHE_TTL_MS;
  if (fresh) return cachedRaw.manifest;
  try {
    const manifest = await fetchJson<QqCompatManifest>(DEFAULT_MANIFEST_URL);
    if (typeof manifest.version !== 'number' || !manifest.policy) {
      throw new Error('manifest schema invalid');
    }
    store.set('qqCompatCache', { manifest, fetchedAt: Date.now() });
    return manifest;
  } catch (err) {
    log.warn(`manifest fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    if (cachedRaw) {
      log.info('using cached manifest');
      return cachedRaw.manifest;
    }
    return defaultManifest();
  }
}

function defaultManifest(): QqCompatManifest {
  return {
    version: 1,
    policy: { allowUnknown: true, warnUnknown: false },
    knownGoodVersions: [],
    knownBadVersions: [],
    minVersion: null,
  };
}

/** Evaluate a local QQ version string against the manifest. */
export type QqCompatVerdict =
  | { kind: 'good'; note?: string }
  | { kind: 'unknown'; warn: boolean }
  | { kind: 'bad'; reason?: string; fixedInDesktopVersion?: string }
  | { kind: 'too-old'; minVersion: string };

export function evaluateQqVersion(manifest: QqCompatManifest, version: string): QqCompatVerdict {
  const bad = manifest.knownBadVersions.find((b) => b.version === version);
  if (bad) return { kind: 'bad', reason: bad.reason, fixedInDesktopVersion: bad.fixedInDesktopVersion };
  if (manifest.minVersion && compareSemver(version, manifest.minVersion) < 0) {
    return { kind: 'too-old', minVersion: manifest.minVersion };
  }
  const good = manifest.knownGoodVersions.find((g) => g.version === version);
  if (good) return { kind: 'good', note: good.note };
  return manifest.policy.allowUnknown
    ? { kind: 'unknown', warn: manifest.policy.warnUnknown ?? false }
    : { kind: 'bad', reason: 'version not in knownGoodVersions and policy disallows unknown' };
}

/** Loose semver compare (returns -1/0/1). Treats non-numeric parts lexically. */
export function compareSemver(a: string, b: string): number {
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
