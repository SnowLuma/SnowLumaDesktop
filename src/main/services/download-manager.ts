import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import AdmZip from 'adm-zip';
import type { MirrorEntry } from '../store/schema';
import { createLogger } from '../util/logger';

const log = createLogger('download');

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_ATTEMPTS_PER_MIRROR = 2;

export interface DownloadProgress {
  bytesDone: number;
  bytesTotal: number | null;
  speedBytesPerSec: number;
  mirrorId: string;
  attempt: number;
}

export interface DownloadOptions {
  version: string;
  file: string;
  destDir: string;
  expectedSha256?: string;
  signal?: AbortSignal;
  onProgress?: (progress: DownloadProgress) => void;
  /** Per-mirror retry count; default 2. */
  attempts?: number;
  /** Per-request timeout in ms; default 60s. */
  timeoutMs?: number;
}

export interface DownloadResult {
  filePath: string;
  mirrorId: string;
  bytesTotal: number;
  sha256: string;
}

export class DownloadError extends Error {
  constructor(
    message: string,
    readonly failures: Array<{ mirrorId: string; attempt: number; error: string }>,
  ) {
    super(message);
    this.name = 'DownloadError';
  }
}

/**
 * Try every enabled mirror in priority order (descending). Each mirror gets
 * `attempts` tries before moving on. Aborts cleanly when `signal` fires.
 *
 * On success the file lives at `<destDir>/<file>` with the matching SHA256.
 */
export async function downloadArtifact(
  mirrors: MirrorEntry[],
  opts: DownloadOptions,
): Promise<DownloadResult> {
  // Priority semantics: smaller wins. 0 = highest priority, 999 = lowest.
  const enabled = mirrors.filter((m) => m.enabled).slice().sort((a, b) => a.priority - b.priority);
  if (enabled.length === 0) {
    throw new DownloadError('no enabled mirrors configured', []);
  }
  await mkdir(opts.destDir, { recursive: true });
  const destPath = join(opts.destDir, opts.file);
  const attemptsPerMirror = opts.attempts ?? DEFAULT_ATTEMPTS_PER_MIRROR;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const failures: Array<{ mirrorId: string; attempt: number; error: string }> = [];
  for (const mirror of enabled) {
    const url = expandTemplate(mirror.template, opts.version, opts.file);
    for (let attempt = 1; attempt <= attemptsPerMirror; attempt++) {
      if (opts.signal?.aborted) {
        throw new DownloadError('aborted', failures);
      }
      try {
        log.info(`download attempt mirror=${mirror.id} attempt=${attempt} url=${url}`);
        const result = await fetchToFile({
          url,
          destPath,
          signal: opts.signal,
          timeoutMs,
          onProgress: (bytesDone, bytesTotal, speed) =>
            opts.onProgress?.({
              bytesDone,
              bytesTotal,
              speedBytesPerSec: speed,
              mirrorId: mirror.id,
              attempt,
            }),
        });
        if (opts.expectedSha256 && result.sha256 !== opts.expectedSha256.toLowerCase()) {
          await rm(destPath, { force: true });
          throw new Error(
            `sha256 mismatch: expected ${opts.expectedSha256} got ${result.sha256}`,
          );
        }
        return {
          filePath: destPath,
          mirrorId: mirror.id,
          bytesTotal: result.bytesTotal,
          sha256: result.sha256,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.warn(`download failed mirror=${mirror.id} attempt=${attempt}: ${message}`);
        failures.push({ mirrorId: mirror.id, attempt, error: message });
        if (opts.signal?.aborted) {
          throw new DownloadError('aborted', failures);
        }
      }
    }
  }
  throw new DownloadError(`all mirrors failed for ${opts.file}`, failures);
}

interface FetchResult {
  sha256: string;
  bytesTotal: number;
}

interface FetchOptions {
  url: string;
  destPath: string;
  signal?: AbortSignal;
  timeoutMs: number;
  onProgress?: (bytesDone: number, bytesTotal: number | null, speedBytesPerSec: number) => void;
}

async function fetchToFile(opts: FetchOptions): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('request timeout')), opts.timeoutMs);
  const onUpstreamAbort = () => controller.abort(opts.signal?.reason ?? new Error('aborted'));
  opts.signal?.addEventListener('abort', onUpstreamAbort, { once: true });

  try {
    const res = await fetch(opts.url, { signal: controller.signal, redirect: 'follow' });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    if (!res.body) {
      throw new Error('response has no body');
    }
    const total = parseInt(res.headers.get('content-length') ?? '', 10);
    const bytesTotal = Number.isFinite(total) ? total : null;

    await mkdir(dirname(opts.destPath), { recursive: true });
    const hash = createHash('sha256');
    const writer = createWriteStream(opts.destPath);

    let bytesDone = 0;
    let lastEmit = Date.now();
    let lastBytes = 0;
    const start = Date.now();
    void start;

    const nodeReadable = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
    nodeReadable.on('data', (chunk: Buffer) => {
      hash.update(chunk);
      bytesDone += chunk.length;
      const now = Date.now();
      if (now - lastEmit >= 100) {
        const speed = ((bytesDone - lastBytes) / (now - lastEmit)) * 1000;
        opts.onProgress?.(bytesDone, bytesTotal, speed);
        lastEmit = now;
        lastBytes = bytesDone;
      }
    });

    await pipeline(nodeReadable, writer);
    opts.onProgress?.(bytesDone, bytesTotal, 0);
    return { sha256: hash.digest('hex'), bytesTotal: bytesDone };
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onUpstreamAbort);
  }
}

export function expandTemplate(template: string, version: string, file: string): string {
  return template.replaceAll('{version}', encodeURIComponent(version)).replaceAll('{file}', encodeURIComponent(file));
}

/**
 * Synchronously extracts a `.zip` archive to `destDir` via adm-zip. Uses
 * `overwrite` so retries are idempotent.
 */
export async function extractZip(zipPath: string, destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true });
  const exists = await stat(zipPath).then(() => true).catch(() => false);
  if (!exists) throw new Error(`zip not found: ${zipPath}`);
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(destDir, /* overwrite */ true);
}

/** Convenience: download + extract in one shot. */
export async function downloadAndExtract(
  mirrors: MirrorEntry[],
  opts: DownloadOptions & { extractTo: string },
): Promise<DownloadResult & { extractedTo: string }> {
  const result = await downloadArtifact(mirrors, opts);
  await extractZip(result.filePath, opts.extractTo);
  return { ...result, extractedTo: opts.extractTo };
}

/** Plain JSON fetch with timeout + abort. Used for QQ compat manifest. */
export async function fetchJson<T = unknown>(
  url: string,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('request timeout')), opts.timeoutMs ?? 15_000);
  const onUpstreamAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onUpstreamAbort, { once: true });
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onUpstreamAbort);
  }
}
