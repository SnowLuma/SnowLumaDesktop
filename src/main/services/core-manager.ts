import { ChildProcess, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from 'electron';
import { coreVersionsDir } from '../util/paths';
import { createLogger } from '../util/logger';
import { getStore } from '../store/store';
import { findFreePort } from './free-port';

const log = createLogger('core-manager');

export type CoreStatus =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'crashed'
  | 'restarting'
  | 'no-version-active';

export interface CoreState {
  status: CoreStatus;
  activeVersion: string | null;
  webuiPort: number | null;
  pid: number | null;
  /** Number of consecutive crash-recover attempts in the current incident. */
  crashStreak: number;
  /** ISO timestamp of last status change. */
  changedAt: string;
  /** Last few stdout/stderr lines for the diagnostic export. */
  recentOutput: string[];
}

interface CoreManagerEvents {
  state: (state: CoreState) => void;
  output: (line: string, stream: 'stdout' | 'stderr') => void;
}

/**
 * Spawns and supervises a single `@snowluma/core` child process.
 *
 * Lifecycle (PLAN.md Phase 2.2):
 *   stopped → starting → running → crashed → restarting → starting → …
 *
 * `start()` is idempotent and safe to call repeatedly. `stop()` waits for the
 * child to exit. `setActiveVersion()` switches the binary on disk and
 * triggers a hot restart.
 *
 * Restart strategy: exponential backoff (5s → 10s → 30s → 60s → 5min), no
 * cap on attempts — core MUST come back up for Desktop to be useful.
 */
export class CoreManager extends EventEmitter {
  private child: ChildProcess | null = null;
  private state: CoreState = {
    status: 'stopped',
    activeVersion: null,
    webuiPort: null,
    pid: null,
    crashStreak: 0,
    changedAt: new Date().toISOString(),
    recentOutput: [],
  };
  private restartTimer: NodeJS.Timeout | null = null;
  private intentionalStop = false;
  private startInFlight: Promise<void> | null = null;
  private readonly maxRecentLines = 200;

  override on<K extends keyof CoreManagerEvents>(event: K, listener: CoreManagerEvents[K]): this {
    return super.on(event, listener);
  }
  override emit<K extends keyof CoreManagerEvents>(event: K, ...args: Parameters<CoreManagerEvents[K]>): boolean {
    return super.emit(event, ...args);
  }

  getState(): CoreState {
    return { ...this.state, recentOutput: [...this.state.recentOutput] };
  }

  async start(): Promise<void> {
    if (this.startInFlight) return this.startInFlight;
    this.startInFlight = this.startInternal();
    try {
      await this.startInFlight;
    } finally {
      this.startInFlight = null;
    }
  }

  private async startInternal(): Promise<void> {
    if (this.child) {
      log.debug('start ignored — child already running');
      return;
    }
    const store = getStore();
    const activeVersion = store.get('activeCoreVersion');
    if (!activeVersion) {
      this.setStatus('no-version-active', { activeVersion: null, pid: null });
      log.warn('no active core version set; nothing to spawn');
      return;
    }
    const versionDir = join(coreVersionsDir(), activeVersion);
    const entry = await resolveEntry(versionDir);
    if (!entry) {
      this.setStatus('no-version-active', { activeVersion, pid: null });
      log.error(`core entry not found under ${versionDir}`);
      return;
    }

    const port = this.state.webuiPort ?? (await findFreePort(5099));
    const credentials = ensureWebuiCredentials();

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      SNOWLUMA_WEBUI_PORT: String(port),
      SNOWLUMA_WEBUI_BOOTSTRAP_PASSWORD: credentials.password,
      SNOWLUMA_HOOK_AUTOLOAD: '1',
    };

    this.setStatus('starting', { activeVersion, webuiPort: port, pid: null });
    this.intentionalStop = false;

    const runtime = resolveNodeRuntime(versionDir);
    if (runtime.kind === 'electron-as-node') {
      // Last-resort fallback: spawning our own executable. MUST set
      // ELECTRON_RUN_AS_NODE=1 so it doesn't relaunch the Desktop app
      // and hit the single-instance lock. We also know the core misses
      // crashpad / pollutes stderr with "crashpad_client_win.cc(869)
      // not connected" in this mode — that's why we now prefer the
      // bundled node.exe inside the version dir whenever it exists.
      env['ELECTRON_RUN_AS_NODE'] = '1';
      delete env['ELECTRON_NO_ATTACH_CONSOLE'];
    }

    // CWD must be the version dir, not a separate runtime dir.
    // SnowLuma core resolves `config/runtime.json`, `data/*.db`,
    // `native/...` etc. RELATIVE TO process.cwd() — the same way the
    // shipped `launcher.bat` (which is literally `node index.mjs`)
    // does. The previous `cwd: coreRuntimeDir()` left those paths
    // dangling and the core silently exited within ~5 seconds,
    // triggering the supervisor's restart loop.
    log.info(
      `spawning core: runtime=${runtime.kind} bin=${runtime.bin} entry=${entry} cwd=${versionDir} port=${port}`,
    );
    const child = spawn(runtime.bin, [entry], {
      cwd: versionDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.child = child;

    child.stdout?.on('data', (buf: Buffer) => this.captureOutput(buf, 'stdout'));
    child.stderr?.on('data', (buf: Buffer) => this.captureOutput(buf, 'stderr'));

    child.on('spawn', () => {
      this.setStatus('running', { activeVersion, webuiPort: port, pid: child.pid ?? null, crashStreak: 0 });
    });

    child.on('exit', (code, signal) => {
      log.warn(`core exited code=${code} signal=${signal} intentional=${this.intentionalStop}`);
      this.child = null;
      if (this.intentionalStop) {
        this.setStatus('stopped', { pid: null });
        return;
      }
      const streak = this.state.crashStreak + 1;
      this.setStatus('crashed', { pid: null, crashStreak: streak });
      this.scheduleRestart(streak);
    });

    child.on('error', (err) => {
      log.error('core child error', err.message);
    });
  }

  async stop(): Promise<void> {
    this.intentionalStop = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (!this.child) {
      this.setStatus('stopped', { pid: null });
      return;
    }
    const child = this.child;
    await new Promise<void>((resolveStop) => {
      const onExit = () => {
        clearTimeout(killTimer);
        resolveStop();
      };
      child.once('exit', onExit);
      const killTimer = setTimeout(() => {
        log.warn('core did not exit within 8s; SIGKILL');
        child.kill('SIGKILL');
      }, 8_000);
      child.kill('SIGTERM');
    });
    this.child = null;
    this.setStatus('stopped', { pid: null });
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  async setActiveVersion(version: string): Promise<void> {
    const store = getStore();
    store.set('activeCoreVersion', version);
    this.setStatus(this.state.status, { activeVersion: version });
    if (this.child) {
      log.info(`hot-switching core version to ${version}`);
      await this.restart();
    } else if (this.state.status === 'no-version-active') {
      await this.start();
    }
  }

  private scheduleRestart(streak: number): void {
    const delay = backoffMs(streak);
    log.info(`scheduling core restart in ${delay}ms (streak=${streak})`);
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(async () => {
      this.restartTimer = null;
      if (this.intentionalStop) return;
      this.setStatus('restarting');
      try {
        await this.start();
      } catch (err) {
        log.error('restart failed', err instanceof Error ? err.message : String(err));
      }
    }, delay);
  }

  private captureOutput(buf: Buffer, stream: 'stdout' | 'stderr'): void {
    const text = buf.toString('utf8');
    const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
    for (const line of lines) {
      log.debug(`core[${stream}] ${line}`);
      this.state.recentOutput.push(`[${stream}] ${line}`);
      if (this.state.recentOutput.length > this.maxRecentLines) {
        this.state.recentOutput.splice(0, this.state.recentOutput.length - this.maxRecentLines);
      }
      this.emit('output', line, stream);
    }
  }

  private setStatus(status: CoreStatus, patch?: Partial<Omit<CoreState, 'status' | 'changedAt' | 'recentOutput'>>): void {
    const next: CoreState = {
      ...this.state,
      status,
      changedAt: new Date().toISOString(),
      ...patch,
    };
    this.state = next;
    this.emit('state', this.getState());
  }
}

/** Exponential backoff: 5s → 10s → 30s → 60s, capped at 5min. */
function backoffMs(streak: number): number {
  const ladder = [5_000, 10_000, 30_000, 60_000, 5 * 60_000];
  return ladder[Math.min(streak - 1, ladder.length - 1)] ?? 5 * 60_000;
}

/** Walks the version dir to find the core entry point. */
async function resolveEntry(versionDir: string): Promise<string | null> {
  const candidates = [
    join(versionDir, 'index.mjs'),
    join(versionDir, 'dist', 'index.mjs'),
    join(versionDir, 'index.js'),
    join(versionDir, 'dist', 'index.js'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  // Last resort: any *.mjs at the top level.
  try {
    const entries = await readdir(versionDir);
    for (const entry of entries) {
      if (entry.endsWith('.mjs')) {
        const full = join(versionDir, entry);
        const st = await stat(full);
        if (st.isFile()) return full;
      }
    }
  } catch {
    return null;
  }
  return null;
}

interface NodeRuntime {
  bin: string;
  kind: 'core-bundled-node' | 'resources-bundled-node' | 'system-node' | 'electron-as-node';
}

/**
 * Locate a JS runtime to spawn core under.
 *
 * Preference order:
 *   1. **`<versionDir>/node[.exe]`** — the Node binary SnowLuma ships
 *      INSIDE the core release zip (see the screenshot the user
 *      provided: `SnowLuma-v1.8.1-win-x64.zip` extracts node.exe right
 *      next to index.mjs). This is the runtime the core was built and
 *      tested against, so it's always the right answer when present.
 *   2. `resources/node/<platform>-<arch>/node[.exe]` (or
 *      `resources/node/node[.exe]`): a Node we might ship inside
 *      Desktop's own asar resources dir as a future fallback.
 *   3. `node[.exe]` on PATH: dev / system-Node fallback. `spawn`
 *      throws ENOENT cleanly if it isn't there.
 *   4. Electron's own executable (`process.execPath`) with
 *      `ELECTRON_RUN_AS_NODE=1`. This worked-but-also-broke in earlier
 *      builds — Electron-as-Node prints "crashpad_client_win.cc(869)
 *      not connected" on every spawn and some native modules behave
 *      subtly differently. Keep it as a last resort so we at least
 *      start instead of erroring out, but warn loudly.
 */
function resolveNodeRuntime(versionDir: string): NodeRuntime {
  const platform = process.platform;
  const arch = process.arch;
  const exe = platform === 'win32' ? 'node.exe' : 'node';

  const coreBundled = join(versionDir, exe);
  if (existsSync(coreBundled)) {
    return { bin: coreBundled, kind: 'core-bundled-node' };
  }

  const resourceCandidates = [
    join(process.resourcesPath, 'node', `${platform}-${arch}`, exe),
    join(process.resourcesPath, 'node', exe),
  ];
  for (const candidate of resourceCandidates) {
    if (existsSync(candidate)) {
      return { bin: candidate, kind: 'resources-bundled-node' };
    }
  }
  if (!app.isPackaged) {
    return { bin: exe, kind: 'system-node' };
  }
  log.warn(
    `no node.exe found under versionDir or resources/; falling back to Electron-as-Node. ` +
      `versionDir was ${versionDir} — re-download this core version to restore the bundled runtime.`,
  );
  return { bin: process.execPath, kind: 'electron-as-node' };
}

/**
 * Ensure a randomly-generated WebUI password exists in electron-store. This
 * is the credential Desktop passes to core via SNOWLUMA_WEBUI_BOOTSTRAP_PASSWORD,
 * and uses to auto-log-in to webui on the renderer side.
 */
function ensureWebuiCredentials(): { username: string; password: string } {
  const store = getStore();
  const existing = store.get('webuiCredentials');
  if (existing && existing.username && existing.password.length >= 16) {
    return existing;
  }
  const password = randomToken(24);
  const next = { username: 'admin', password };
  store.set('webuiCredentials', next);
  log.info('generated new webui credentials for Desktop auto-login');
  return next;
}

function randomToken(bytes: number): string {
  // Node 22 exposes globalThis.crypto.getRandomValues per WebCrypto.
  const arr = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < arr.length; i++) out += arr[i]!.toString(16).padStart(2, '0');
  return out;
}
