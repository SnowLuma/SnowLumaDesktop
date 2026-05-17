import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Minimal typed JSON file store with the slice of the electron-store
 * API we actually use (`get` / `set` / `delete` / `clear`). Written
 * because electron-store v11 is ESM-only and breaks under rolldown's
 * CJS output for the Electron main process — see the
 * "electron_store.default is not a constructor" failure in
 * 2026-05-17 logs. The data set is tiny (~15 keys), so a 60-line
 * sync-fs wrapper is more than enough.
 *
 * Semantics:
 *   - Lazy load: file is read on first access, missing → defaults.
 *   - Sync write: every `set` / `delete` flushes via atomic
 *     write-then-rename. Acceptable because writes are user-driven
 *     and the file is small (<10 KB).
 *   - Defaults: when a key isn't present in the on-disk JSON, the
 *     default from the constructor is returned (and persisted on
 *     first read so the file is self-documenting).
 */
export class JsonStore<Schema extends object> {
  private cache: Schema | null = null;
  private readonly filePath: string;
  private readonly defaults: Schema;

  constructor(opts: { cwd: string; name?: string; defaults: Schema }) {
    const name = opts.name ?? 'config';
    this.filePath = join(opts.cwd, `${name}.json`);
    this.defaults = opts.defaults;
  }

  get path(): string {
    return this.filePath;
  }

  get<K extends keyof Schema>(key: K): Schema[K] {
    const data = this.load();
    return data[key];
  }

  set<K extends keyof Schema>(key: K, value: Schema[K]): void {
    const data = this.load();
    if (Object.is(data[key], value)) return;
    data[key] = value;
    this.persist(data);
  }

  delete<K extends keyof Schema>(key: K): void {
    const data = this.load();
    if (!(key in data)) return;
    delete data[key];
    this.persist(data);
  }

  clear(): void {
    this.cache = { ...this.defaults };
    this.persist(this.cache);
  }

  private load(): Schema {
    if (this.cache) return this.cache;
    let onDisk: Partial<Schema> = {};
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf8');
        if (raw.trim().length > 0) {
          const parsed = JSON.parse(raw) as unknown;
          if (parsed && typeof parsed === 'object') {
            onDisk = parsed as Partial<Schema>;
          }
        }
      }
    } catch {
      // Corrupt file → fall back to defaults rather than crashing.
      onDisk = {};
    }
    const merged: Schema = { ...this.defaults, ...onDisk } as Schema;
    this.cache = merged;
    return merged;
  }

  private persist(data: Schema): void {
    this.cache = data;
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      const tmp = this.filePath + '.tmp';
      writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
      renameSync(tmp, this.filePath);
    } catch {
      // Swallow disk errors — the in-memory cache is still updated so
      // the running app stays consistent. Persistence will retry on the
      // next set().
    }
  }
}
