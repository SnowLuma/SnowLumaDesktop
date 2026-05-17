import { createLogger } from '../util/logger';

const log = createLogger('github-api');

const DEFAULT_TIMEOUT_MS = 12_000;

export interface GithubReleaseAsset {
  name: string;
  size: number;
  browserDownloadUrl: string;
  contentType: string;
}

export interface GithubRelease {
  tagName: string;
  name: string | null;
  prerelease: boolean;
  draft: boolean;
  publishedAt: string | null;
  body: string | null;
  assets: GithubReleaseAsset[];
  htmlUrl: string;
}

/**
 * Hit the public GitHub API for the list of releases on a repo.
 *
 * `electron-updater` has its own checker but it's fragile in our setup:
 *   - It needs a `latest.yml` asset which our nightly workflow doesn't
 *     publish (so the modern code path fails outright).
 *   - The atom-feed fallback parses HTML and chokes when GitHub
 *     decides to return 406 + CSP-laden response bodies for a
 *     prereleases-only repo.
 *
 * The REST API is plain JSON, supports prereleases out of the box,
 * and is the source of truth for both
 *   - "is there a new Desktop?" (this file)
 *   - "what core versions are available to download?" (Settings UI)
 *
 * Unauthenticated calls have a 60 req/hour limit per IP which is more
 * than enough for our use case. We don't paginate — `per_page=30`
 * is plenty for a release list, and GitHub orders most-recent first.
 */
export async function listReleases(
  owner: string,
  repo: string,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<GithubRelease[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=30`;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error('github api request timeout')),
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  const onUpstreamAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onUpstreamAbort, { once: true });

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'SnowLumaDesktop',
      },
    });
    if (!res.ok) {
      throw new Error(`github api responded HTTP ${res.status} ${res.statusText}`);
    }
    const raw = (await res.json()) as unknown;
    if (!Array.isArray(raw)) {
      throw new Error('github api returned non-array response');
    }
    return raw.map((entry) => parseRelease(entry as Record<string, unknown>)).filter(notNull);
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onUpstreamAbort);
  }
}

function parseRelease(raw: Record<string, unknown>): GithubRelease | null {
  const tagName = typeof raw['tag_name'] === 'string' ? (raw['tag_name'] as string) : null;
  if (!tagName) return null;
  const assetsRaw = Array.isArray(raw['assets']) ? (raw['assets'] as unknown[]) : [];
  const assets: GithubReleaseAsset[] = [];
  for (const a of assetsRaw) {
    if (!a || typeof a !== 'object') continue;
    const obj = a as Record<string, unknown>;
    const name = typeof obj['name'] === 'string' ? obj['name'] : null;
    const url = typeof obj['browser_download_url'] === 'string' ? obj['browser_download_url'] : null;
    if (!name || !url) continue;
    assets.push({
      name,
      size: typeof obj['size'] === 'number' ? obj['size'] : 0,
      browserDownloadUrl: url,
      contentType: typeof obj['content_type'] === 'string' ? obj['content_type'] : '',
    });
  }
  return {
    tagName,
    name: typeof raw['name'] === 'string' ? (raw['name'] as string) : null,
    prerelease: raw['prerelease'] === true,
    draft: raw['draft'] === true,
    publishedAt: typeof raw['published_at'] === 'string' ? (raw['published_at'] as string) : null,
    body: typeof raw['body'] === 'string' ? (raw['body'] as string) : null,
    assets,
    htmlUrl: typeof raw['html_url'] === 'string' ? (raw['html_url'] as string) : '',
  };
}

function notNull<T>(v: T | null): v is T {
  return v !== null;
}

void log; // reserved for future tracing
