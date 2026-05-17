import { existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createLogger } from '../util/logger';

const log = createLogger('qq-detector');
const execFileP = promisify(execFile);

export interface QqInstall {
  path: string;
  version: string | null;
}

/**
 * Detect a usable QQ install on Windows.
 *
 * Search order (4a-iv):
 *   1. Common default paths under every drive letter that exists.
 *      QQ frequently lives outside C:\ (D:\Program Files (x86)\Tencent\QQNT
 *      etc. are common), so a C:-only scan misses real installs.
 *   2. Registry uninstall keys (`HKCU` + `HKLM` `Software\Tencent\QQNT`).
 *   3. PATH lookup.
 *
 * QQNT layout: the launcher `QQ.exe` lives at the install root.
 * Per-version resources sit under `versions/<x.y.z-build>/` (e.g.
 * `versions/9.9.30-48517/`) — those folders hold assets only, NOT an
 * executable. When that subdir exists, the highest-sorted folder name
 * is the most reliable version we can get without invoking PowerShell
 * to read PE resources.
 *
 * Returns the first hit; null when nothing found. Cross-platform stub
 * (macOS/Linux) returns null — Desktop targets win32-x64 only.
 */
export async function detectQqInstall(): Promise<QqInstall | null> {
  if (process.platform !== 'win32') {
    log.debug('detectQqInstall: not win32, returning null');
    return null;
  }

  for (const root of defaultRootCandidates()) {
    const hit = await probeQqNtRoot(root);
    if (hit) {
      log.info(`qq detected at ${hit.path} version=${hit.version ?? 'unknown'}`);
      return hit;
    }
  }

  for (const candidate of legacyExeCandidates()) {
    if (existsSync(candidate)) {
      const version = await readVersion(candidate).catch(() => null);
      log.info(`qq detected (legacy path) at ${candidate} version=${version ?? 'unknown'}`);
      return { path: candidate, version };
    }
  }

  const fromRegistry = await detectViaRegistry().catch((err) => {
    log.warn(`registry detect failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  });
  if (fromRegistry) return fromRegistry;

  const fromPath = await detectViaWhere().catch(() => null);
  if (fromPath) return fromPath;

  log.warn('qq not detected anywhere');
  return null;
}

/**
 * Build the list of `<drive>\Program Files\Tencent\QQNT` /
 * `<drive>\Program Files (x86)\Tencent\QQNT` candidates across every
 * drive letter that currently exists. On a typical Windows box this
 * resolves to a handful of paths (most drive letters don't exist), so
 * checking each with `existsSync` is cheap.
 */
function defaultRootCandidates(): string[] {
  const drives: string[] = [];
  for (let code = 'A'.charCodeAt(0); code <= 'Z'.charCodeAt(0); code++) {
    const drive = `${String.fromCharCode(code)}:\\`;
    if (existsSync(drive)) drives.push(drive);
  }
  const roots: string[] = [];
  for (const drive of drives) {
    roots.push(join(drive, 'Program Files', 'Tencent', 'QQNT'));
    roots.push(join(drive, 'Program Files (x86)', 'Tencent', 'QQNT'));
  }
  const localAppData = process.env['LOCALAPPDATA'];
  if (localAppData) {
    roots.push(join(localAppData, 'Programs', 'QQNT'));
  }
  return Array.from(new Set(roots));
}

/**
 * Legacy QQ (pre-NT) layout — kept around so older installs still
 * resolve when QQNT isn't present.
 */
function legacyExeCandidates(): string[] {
  const drives: string[] = [];
  for (let code = 'A'.charCodeAt(0); code <= 'Z'.charCodeAt(0); code++) {
    const drive = `${String.fromCharCode(code)}:\\`;
    if (existsSync(drive)) drives.push(drive);
  }
  const out: string[] = [];
  for (const drive of drives) {
    out.push(join(drive, 'Program Files', 'Tencent', 'QQ', 'Bin', 'QQ.exe'));
    out.push(join(drive, 'Program Files (x86)', 'Tencent', 'QQ', 'Bin', 'QQ.exe'));
  }
  return Array.from(new Set(out));
}

/**
 * Resolve a QQNT install root → `{ path: <root>\QQ.exe, version }`.
 *
 * `QQ.exe` is always at the root. Version identification preference:
 *   1. The highest-sorted folder under `versions/` (e.g. `9.9.30-48517`).
 *      Folder name doubles as the version string — same format the
 *      QQNT launcher reports — and is cheaper than spawning PowerShell.
 *   2. Falls back to reading the PE-resource ProductVersion of QQ.exe
 *      when `versions/` is missing or empty.
 */
async function probeQqNtRoot(root: string): Promise<QqInstall | null> {
  if (!existsSync(root)) return null;
  const exePath = join(root, 'QQ.exe');
  if (!existsSync(exePath)) return null;

  let version: string | null = null;
  const versionsDir = join(root, 'versions');
  if (existsSync(versionsDir)) {
    const best = await pickBestVersion(versionsDir);
    if (best) version = best.name;
  }
  if (!version) {
    version = await readVersion(exePath).catch(() => null);
  }
  return { path: exePath, version };
}

interface VersionFolder {
  name: string;
  parts: number[];
}

async function pickBestVersion(versionsDir: string): Promise<VersionFolder | null> {
  let entries: string[];
  try {
    entries = await readdir(versionsDir);
  } catch {
    return null;
  }
  const folders: VersionFolder[] = [];
  for (const name of entries) {
    const full = join(versionsDir, name);
    const st = await stat(full).catch(() => null);
    if (!st?.isDirectory()) continue;
    folders.push({ name, parts: parseVersionParts(name) });
  }
  if (folders.length === 0) return null;
  folders.sort((a, b) => compareVersionParts(b.parts, a.parts));
  return folders[0] ?? null;
}

function parseVersionParts(s: string): number[] {
  return s
    .split(/[.\-_]/)
    .map((p) => {
      const n = Number(p);
      return Number.isFinite(n) ? n : 0;
    });
}

function compareVersionParts(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

async function detectViaRegistry(): Promise<QqInstall | null> {
  // Lazy-load `regedit` so non-win32 builds don't need the native binary
  // to load at startup.
  let regedit: typeof import('regedit');
  try {
    regedit = await import('regedit');
  } catch {
    return null;
  }
  const keys = [
    'HKCU\\Software\\Tencent\\QQNT',
    'HKLM\\Software\\Tencent\\QQNT',
    'HKLM\\Software\\WOW6432Node\\Tencent\\QQNT',
  ];
  const promisified = regedit.promisified ?? regedit;
  const results = await (promisified as { list(keys: string[]): Promise<Record<string, RegListEntry>> }).list(keys);
  for (const key of keys) {
    const entry = results[key];
    if (!entry?.exists) continue;
    const installPath =
      (entry.values?.['Install']?.value as string | undefined) ??
      (entry.values?.['InstallLocation']?.value as string | undefined);
    if (!installPath) continue;
    const fromRoot = await probeQqNtRoot(installPath);
    if (fromRoot) {
      const declaredVersion = entry.values?.['Version']?.value as string | undefined;
      return { path: fromRoot.path, version: fromRoot.version ?? declaredVersion ?? null };
    }
    const exe = await locateQqExe(installPath);
    if (!exe) continue;
    const version = (entry.values?.['Version']?.value as string | undefined) ?? null;
    return { path: exe, version };
  }
  return null;
}

interface RegListEntry {
  exists: boolean;
  values?: Record<string, { value: unknown; type: string }>;
}

async function locateQqExe(installDir: string): Promise<string | null> {
  const candidates = [join(installDir, 'QQ.exe'), join(installDir, 'Bin', 'QQ.exe')];
  for (const c of candidates) {
    if (existsSync(c)) {
      const s = await stat(c).catch(() => null);
      if (s?.isFile()) return c;
    }
  }
  return null;
}

async function detectViaWhere(): Promise<QqInstall | null> {
  try {
    const { stdout } = await execFileP('where', ['QQ.exe'], { windowsHide: true });
    const line = stdout.split(/\r?\n/).map((s) => s.trim()).find((s) => s.length > 0);
    if (line && existsSync(line)) {
      const version = await readVersion(line).catch(() => null);
      return { path: line, version };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Read PE-resource ProductVersion from a Windows binary via PowerShell.
 * Returns the dotted version string, or null if unavailable.
 */
export async function readVersion(qqExePath: string): Promise<string | null> {
  if (process.platform !== 'win32') return null;
  const script = `(Get-Item ${psQuote(qqExePath)}).VersionInfo.ProductVersion`;
  try {
    const { stdout } = await execFileP(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, timeout: 5_000 },
    );
    const trimmed = stdout.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

function psQuote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

/** Get the install root directory of QQ (parent of QQ.exe). */
export function qqInstallRoot(qqExePath: string): string {
  return dirname(qqExePath);
}
