import { createLogger } from '../util/logger';
import { getStore } from '../store/store';

const log = createLogger('webui-session');

/**
 * Login to the bundled core's WebUI using the credentials Desktop seeded
 * via SNOWLUMA_WEBUI_BOOTSTRAP_PASSWORD, returning a bearer token.
 *
 * Desktop injects this token into the BrowserWindow before navigation so
 * users never see the WebUI login page when accessing it through Desktop.
 */
export interface WebuiToken {
  token: string;
  expiresAt: number;
}

export async function loginWebui(port: number, signal?: AbortSignal): Promise<WebuiToken> {
  const store = getStore();
  const credentials = store.get('webuiCredentials');
  if (!credentials) {
    throw new Error('webui credentials not seeded yet; spawn core first');
  }
  const url = `http://127.0.0.1:${port}/api/login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: credentials.username, password: credentials.password }),
    signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`webui login failed: HTTP ${res.status} ${detail}`);
  }
  const body = (await res.json()) as { token?: string; expiresAt?: number };
  if (!body.token) throw new Error('webui login response missing token');
  log.info('webui session established');
  return { token: body.token, expiresAt: body.expiresAt ?? Date.now() + 12 * 3600_000 };
}

/**
 * Poll core's /api/status until it answers OK. Returns true on success,
 * false on timeout.
 */
export async function waitForCoreReady(port: number, timeoutMs = 30_000): Promise<boolean> {
  const url = `http://127.0.0.1:${port}/api/status`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3_000) });
      if (res.ok || res.status === 401) {
        // 401 is fine — server is up, just unauthenticated.
        return true;
      }
    } catch {
      // server still warming up
    }
    await sleep(500);
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
