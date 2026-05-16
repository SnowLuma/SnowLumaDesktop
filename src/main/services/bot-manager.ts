import { ChildProcess, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { BotRecord } from '@shared/types';
import { botDir, botsDir, trashDir } from '../util/paths';
import { createLogger } from '../util/logger';
import { getStore } from '../store/store';
import type { CoreManager } from './core-manager';
import { qqInstallRoot } from './qq-detector';

const log = createLogger('bot-manager');

export type BotStatus =
  | 'offline'         // not started
  | 'launching-qq'    // spawning QQ.exe
  | 'awaiting-login'  // QQ is up, waiting for user to scan QR / enter password
  | 'online'          // core injected, bridge live
  | 'reconnecting'    // QQ crashed, waiting for restart
  | 'needs-attention' // restart cap hit or unrecoverable
  | 'user-managed';   // 4b user-managed: Desktop won't launch QQ

export interface BotRuntimeState {
  uin: string;
  status: BotStatus;
  /** Current QQ.exe PID, if Desktop-managed. */
  qqPid: number | null;
  /** Number of consecutive QQ-crash recoveries in the current incident. */
  crashStreak: number;
  /** Last meaningful status transition timestamp. */
  changedAt: string;
  /** Last status error string, if any. */
  lastError: string | null;
}

interface BotProcess {
  uin: string;
  child: ChildProcess | null;
  restartTimer: NodeJS.Timeout | null;
  intentionallyStopped: boolean;
}

interface BotManagerEvents {
  state: (states: BotRuntimeState[]) => void;
  'bot-online': (uin: string) => void;
  'bot-offline': (uin: string) => void;
}

const MAX_CONCURRENT_LAUNCHES = 2; // 11e

/**
 * Manages QQ.exe child processes per Bot + coordinates with the running
 * core for injection state. Tracks per-Bot status, multi-instance
 * concurrency (max 2 simultaneous launches), and TG-style 5s undo deletes.
 *
 * Login detection: Desktop polls the running core's `/api/bots` (or
 * equivalent) every few seconds while a Bot is `awaiting-login`. When the
 * UIN appears as live, the Bot flips to `online`. The actual endpoint
 * shape is pinned to core's webui REST API surface; Desktop's loginPoll
 * uses fetch with the auto-injected token.
 */
export class BotManager extends EventEmitter {
  private readonly processes = new Map<string, BotProcess>();
  private readonly runtimeStates = new Map<string, BotRuntimeState>();
  private readonly inflightLaunches = new Set<string>();
  private launchQueue: string[] = [];

  constructor(private readonly core: CoreManager) {
    super();
    // Hydrate runtime states from stored Bot list (all start offline).
    const store = getStore();
    const bots = store.get('bots');
    for (const uin of Object.keys(bots)) {
      this.runtimeStates.set(uin, makeInitialState(uin));
    }
  }

  override on<K extends keyof BotManagerEvents>(event: K, listener: BotManagerEvents[K]): this {
    return super.on(event, listener);
  }
  override emit<K extends keyof BotManagerEvents>(event: K, ...args: Parameters<BotManagerEvents[K]>): boolean {
    return super.emit(event, ...args);
  }

  listBots(): BotRecord[] {
    const store = getStore();
    const bots = store.get('bots');
    const order = store.get('botOrder');
    return order.map((uin) => bots[uin]).filter((b): b is BotRecord => !!b);
  }

  getStates(): BotRuntimeState[] {
    return Array.from(this.runtimeStates.values());
  }

  upsertBot(record: BotRecord): { kind: 'created' | 'updated' } {
    const store = getStore();
    const bots = store.get('bots');
    const existed = !!bots[record.uin];
    bots[record.uin] = record;
    store.set('bots', bots);
    if (!existed) {
      const order = store.get('botOrder');
      if (!order.includes(record.uin)) {
        store.set('botOrder', [...order, record.uin]);
      }
      this.runtimeStates.set(record.uin, makeInitialState(record.uin));
    }
    this.emit('state', this.getStates());
    return { kind: existed ? 'updated' : 'created' };
  }

  /** Stage delete: move Bot data to .trash with timestamp. Caller can undo. */
  async stageDelete(uin: string, opts: { withData: boolean; withConfig: boolean }): Promise<{ trashEntry: string }> {
    await this.stop(uin);
    const store = getStore();
    const bots = store.get('bots');
    const order = store.get('botOrder');
    const record = bots[uin];
    if (!record) throw new Error(`bot ${uin} does not exist`);

    const trashEntry = `${uin}-${Date.now()}`;
    const trashEntryDir = join(trashDir(), trashEntry);
    await mkdir(trashEntryDir, { recursive: true });

    const movedPaths: string[] = [];
    if (opts.withData || opts.withConfig) {
      const srcDir = botDir(uin);
      if (existsSync(srcDir)) {
        const dest = join(trashEntryDir, 'bot-files');
        await rename(srcDir, dest).catch(async () => {
          // Cross-device fallback: copy + remove.
          const { cp } = await import('node:fs/promises');
          await cp(srcDir, dest, { recursive: true });
          await rm(srcDir, { recursive: true, force: true });
        });
        movedPaths.push(dest);
      }
    }

    // Persist undo metadata
    const { writeFile } = await import('node:fs/promises');
    await writeFile(
      join(trashEntryDir, 'undo.json'),
      JSON.stringify({ uin, record, options: opts, movedPaths }, null, 2),
      'utf8',
    );

    // Always remove from registry (so the Bot is hidden from the UI even if data is preserved).
    delete bots[uin];
    store.set('bots', bots);
    store.set('botOrder', order.filter((u) => u !== uin));
    this.runtimeStates.delete(uin);
    this.emit('state', this.getStates());
    return { trashEntry };
  }

  /** Restore from the .trash within the 5s undo window. */
  async undoDelete(trashEntry: string): Promise<void> {
    const trashEntryDir = join(trashDir(), trashEntry);
    const { readFile } = await import('node:fs/promises');
    const meta = JSON.parse(await readFile(join(trashEntryDir, 'undo.json'), 'utf8')) as {
      uin: string;
      record: BotRecord;
      options: { withData: boolean; withConfig: boolean };
      movedPaths: string[];
    };
    // Restore files
    const moved = meta.movedPaths[0];
    if (moved && existsSync(moved)) {
      const target = botDir(meta.uin);
      await rename(moved, target).catch(async () => {
        const { cp } = await import('node:fs/promises');
        await cp(moved, target, { recursive: true });
        await rm(moved, { recursive: true, force: true });
      });
    }
    // Restore record
    this.upsertBot(meta.record);
    await rm(trashEntryDir, { recursive: true, force: true });
  }

  /** Hard delete after the undo window. */
  async finalizeDelete(trashEntry: string): Promise<void> {
    const trashEntryDir = join(trashDir(), trashEntry);
    await rm(trashEntryDir, { recursive: true, force: true });
  }

  /** Scan bots/ for UINs not in the registry — used by 14e startup import scan. */
  async findOrphanBotDirs(): Promise<string[]> {
    try {
      const dir = botsDir();
      if (!existsSync(dir)) return [];
      const entries = await readdir(dir, { withFileTypes: true });
      const store = getStore();
      const registered = new Set(Object.keys(store.get('bots')));
      const orphans: string[] = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (!/^\d+$/.test(entry.name)) continue;
        if (!registered.has(entry.name)) orphans.push(entry.name);
      }
      return orphans;
    } catch (err) {
      log.warn(`orphan scan failed: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  async start(uin: string): Promise<void> {
    const record = this.requireBot(uin);
    if (record.launchMode === 'user') {
      this.setStatus(uin, 'user-managed', { lastError: null });
      log.info(`bot ${uin} is user-managed; Desktop will not launch QQ`);
      return;
    }
    if (this.inflightLaunches.has(uin) || this.processes.has(uin)) {
      return;
    }
    if (this.inflightLaunches.size >= MAX_CONCURRENT_LAUNCHES) {
      if (!this.launchQueue.includes(uin)) this.launchQueue.push(uin);
      this.setStatus(uin, 'offline', { lastError: 'queued — too many launches in flight' });
      log.info(`bot ${uin} queued, ${this.inflightLaunches.size} launches in flight`);
      return;
    }
    this.inflightLaunches.add(uin);
    try {
      await this.spawnQq(uin);
    } finally {
      this.inflightLaunches.delete(uin);
      this.drainQueue();
    }
  }

  async stop(uin: string): Promise<void> {
    const proc = this.processes.get(uin);
    if (!proc) {
      this.setStatus(uin, 'offline');
      return;
    }
    proc.intentionallyStopped = true;
    if (proc.restartTimer) {
      clearTimeout(proc.restartTimer);
      proc.restartTimer = null;
    }
    if (proc.child) {
      await new Promise<void>((resolveStop) => {
        const onExit = () => {
          clearTimeout(killTimer);
          resolveStop();
        };
        proc.child!.once('exit', onExit);
        const killTimer = setTimeout(() => {
          proc.child?.kill('SIGKILL');
        }, 8_000);
        proc.child!.kill('SIGTERM');
      });
    }
    this.processes.delete(uin);
    this.setStatus(uin, 'offline');
  }

  async stopAll(): Promise<void> {
    const uins = Array.from(this.processes.keys());
    await Promise.allSettled(uins.map((uin) => this.stop(uin)));
  }

  /** Bot saw a successful bridge login: flip status. Called by tRPC bot.markOnline. */
  markOnline(uin: string): void {
    if (!this.runtimeStates.has(uin)) return;
    this.setStatus(uin, 'online', { crashStreak: 0, lastError: null });
    this.emit('bot-online', uin);
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private requireBot(uin: string): BotRecord {
    const record = getStore().get('bots')[uin];
    if (!record) throw new Error(`bot ${uin} not found`);
    return record;
  }

  private async spawnQq(uin: string): Promise<void> {
    const record = this.requireBot(uin);
    if (!existsSync(record.qqPath)) {
      this.setStatus(uin, 'needs-attention', {
        lastError: `QQ.exe missing at ${record.qqPath}; click "重新检测 QQ 路径"`,
      });
      log.error(`bot ${uin}: QQ.exe missing at ${record.qqPath}`);
      return;
    }
    this.setStatus(uin, 'launching-qq', { lastError: null });
    const child = spawn(record.qqPath, [], {
      cwd: qqInstallRoot(record.qqPath),
      detached: false,
      stdio: 'ignore',
      windowsHide: false,
    });
    const proc: BotProcess = { uin, child, restartTimer: null, intentionallyStopped: false };
    this.processes.set(uin, proc);

    child.on('spawn', () => {
      this.setStatus(uin, 'awaiting-login', { qqPid: child.pid ?? null });
      log.info(`bot ${uin}: QQ.exe spawned pid=${child.pid}`);
    });
    child.on('exit', (code, signal) => {
      log.warn(`bot ${uin}: QQ.exe exit code=${code} signal=${signal} intentional=${proc.intentionallyStopped}`);
      proc.child = null;
      if (proc.intentionallyStopped) {
        this.processes.delete(uin);
        this.setStatus(uin, 'offline', { qqPid: null });
        this.emit('bot-offline', uin);
        return;
      }
      const streak = (this.runtimeStates.get(uin)?.crashStreak ?? 0) + 1;
      if (streak > 5) {
        this.setStatus(uin, 'needs-attention', {
          qqPid: null,
          crashStreak: streak,
          lastError: 'QQ 反复退出，已停止自动重启',
        });
        this.processes.delete(uin);
        this.emit('bot-offline', uin);
        return;
      }
      this.setStatus(uin, 'reconnecting', { qqPid: null, crashStreak: streak });
      const delay = qqBackoff(streak);
      proc.restartTimer = setTimeout(() => {
        proc.restartTimer = null;
        void this.spawnQq(uin);
      }, delay);
    });
    child.on('error', (err) => {
      log.error(`bot ${uin}: spawn error ${err.message}`);
      this.setStatus(uin, 'needs-attention', { lastError: err.message });
    });
    void this.core; // referenced for future polling integration
  }

  private drainQueue(): void {
    while (this.launchQueue.length > 0 && this.inflightLaunches.size < MAX_CONCURRENT_LAUNCHES) {
      const next = this.launchQueue.shift();
      if (!next) break;
      void this.start(next);
    }
  }

  private setStatus(
    uin: string,
    status: BotStatus,
    patch?: Partial<Omit<BotRuntimeState, 'uin' | 'status' | 'changedAt'>>,
  ): void {
    const prev = this.runtimeStates.get(uin) ?? makeInitialState(uin);
    const next: BotRuntimeState = {
      ...prev,
      status,
      changedAt: new Date().toISOString(),
      ...patch,
    };
    this.runtimeStates.set(uin, next);
    this.emit('state', this.getStates());
  }
}

function makeInitialState(uin: string): BotRuntimeState {
  return {
    uin,
    status: 'offline',
    qqPid: null,
    crashStreak: 0,
    changedAt: new Date().toISOString(),
    lastError: null,
  };
}

/** QQ restart backoff (5c): 5s → 10s → 30s → 60s → 5min, then needs-attention. */
function qqBackoff(streak: number): number {
  const ladder = [5_000, 10_000, 30_000, 60_000, 5 * 60_000];
  return ladder[Math.min(streak - 1, ladder.length - 1)] ?? 5 * 60_000;
}

export async function cleanupOldTrash(maxAgeMs = 5_000): Promise<void> {
  const dir = trashDir();
  if (!existsSync(dir)) return;
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const now = Date.now();
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = entry.name.match(/-(\d+)$/);
    if (!match) continue;
    const timestamp = Number(match[1]);
    if (!Number.isFinite(timestamp)) continue;
    if (now - timestamp > maxAgeMs) {
      const full = join(dir, entry.name);
      const s = await stat(full).catch(() => null);
      if (s) await rm(full, { recursive: true, force: true });
    }
  }
}
