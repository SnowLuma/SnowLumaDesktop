import { existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
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
 *   1. Common default paths
 *   2. Registry uninstall keys (`HKCU` + `HKLM` `Software\Tencent\QQNT`)
 *   3. PATH lookup
 *
 * Returns the first hit; null when nothing found. Cross-platform stub
 * (macOS/Linux) returns null — Desktop targets win32-x64 only.
 */
export async function detectQqInstall(): Promise<QqInstall | null> {
  if (process.platform !== 'win32') {
    log.debug('detectQqInstall: not win32, returning null');
    return null;
  }

  for (const candidate of defaultPathCandidates()) {
    if (existsSync(candidate)) {
      const version = await readVersion(candidate).catch(() => null);
      log.info(`qq detected at ${candidate} version=${version ?? 'unknown'}`);
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

function defaultPathCandidates(): string[] {
  const programFiles = process.env['ProgramFiles'] ?? 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
  const localAppData = process.env['LOCALAPPDATA'] ?? '';
  return [
    join(programFiles, 'Tencent', 'QQNT', 'QQ.exe'),
    join(programFilesX86, 'Tencent', 'QQNT', 'QQ.exe'),
    join(programFiles, 'Tencent', 'QQ', 'Bin', 'QQ.exe'),
    join(programFilesX86, 'Tencent', 'QQ', 'Bin', 'QQ.exe'),
    join(localAppData, 'Programs', 'QQNT', 'QQ.exe'),
  ].filter(Boolean);
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
