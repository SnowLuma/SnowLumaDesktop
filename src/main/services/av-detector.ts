import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { app } from 'electron';
import { join } from 'node:path';
import { createLogger } from '../util/logger';

const log = createLogger('av-detector');
const execFileP = promisify(execFile);

export interface AvDetectionResult {
  defender: DefenderStatus;
  thirdParty: ThirdPartyAv[];
}

export interface DefenderStatus {
  /** "running" / "off" / "unknown". */
  status: 'running' | 'off' | 'unknown';
  realtimeProtection: boolean | null;
  amServiceEnabled: boolean | null;
}

export interface ThirdPartyAv {
  /** Display name like "360 Total Security" / "火绒安全". */
  name: string;
  /** Process or service hint. */
  processName: string;
}

/** Process names commonly associated with consumer AVs in mainland China + ROW. */
const KNOWN_AV_PROCESSES: Array<{ name: string; processes: string[] }> = [
  { name: '360 Total Security', processes: ['360tray.exe', '360safe.exe', '360sd.exe'] },
  { name: '火绒安全', processes: ['hipstray.exe', 'huorong.exe', 'hipsdaemon.exe'] },
  { name: 'QQ 管家', processes: ['qqpctray.exe', 'qmemocaptureshelper.exe'] },
  { name: 'Avast', processes: ['avastui.exe', 'avastsvc.exe'] },
  { name: 'AVG', processes: ['avgui.exe', 'avgsvc.exe'] },
  { name: 'Kaspersky', processes: ['avp.exe', 'avpui.exe'] },
  { name: 'McAfee', processes: ['mcsvhost.exe', 'mcuicnt.exe'] },
  { name: 'ESET', processes: ['ekrn.exe', 'egui.exe'] },
];

export async function detectAv(): Promise<AvDetectionResult> {
  if (process.platform !== 'win32') {
    return { defender: { status: 'unknown', realtimeProtection: null, amServiceEnabled: null }, thirdParty: [] };
  }
  const [defender, thirdParty] = await Promise.all([detectDefender(), detectThirdParty()]);
  return { defender, thirdParty };
}

async function detectDefender(): Promise<DefenderStatus> {
  const script =
    'try { $s = Get-MpComputerStatus -ErrorAction Stop; ' +
    '"" + $s.AntivirusEnabled + "|" + $s.RealTimeProtectionEnabled + "|" + $s.AMServiceEnabled ' +
    '} catch { "error|error|error" }';
  try {
    const { stdout } = await execFileP(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, timeout: 10_000 },
    );
    const [enabled, realtime, amService] = stdout.trim().split('|');
    if (enabled === 'error') {
      return { status: 'unknown', realtimeProtection: null, amServiceEnabled: null };
    }
    return {
      status: enabled === 'True' ? 'running' : 'off',
      realtimeProtection: realtime === 'True' ? true : realtime === 'False' ? false : null,
      amServiceEnabled: amService === 'True' ? true : amService === 'False' ? false : null,
    };
  } catch (err) {
    log.warn(`defender query failed: ${err instanceof Error ? err.message : String(err)}`);
    return { status: 'unknown', realtimeProtection: null, amServiceEnabled: null };
  }
}

async function detectThirdParty(): Promise<ThirdPartyAv[]> {
  try {
    const { stdout } = await execFileP(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', 'Get-Process | Select-Object -ExpandProperty Name'],
      { windowsHide: true, timeout: 10_000 },
    );
    const running = new Set(stdout.split(/\r?\n/).map((s) => s.trim().toLowerCase()));
    const found: ThirdPartyAv[] = [];
    for (const av of KNOWN_AV_PROCESSES) {
      for (const proc of av.processes) {
        const baseName = proc.toLowerCase().replace(/\.exe$/, '');
        if (running.has(baseName)) {
          found.push({ name: av.name, processName: proc });
          break;
        }
      }
    }
    return found;
  } catch (err) {
    log.warn(`process list failed: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

/**
 * Generate the PowerShell command that adds the Desktop and core data dirs
 * to Windows Defender's exclusion list. UI surfaces it as text; running it
 * needs an elevated shell (8d-ii).
 */
export function buildDefenderWhitelistScript(extraPaths: string[] = []): string {
  const paths = new Set<string>(extraPaths);
  const installDir = app.getAppPath();
  paths.add(installDir);
  paths.add(app.getPath('userData'));
  paths.add(app.getPath('exe'));
  paths.add(join(app.getPath('userData'), 'core'));
  paths.add(join(app.getPath('userData'), 'runtime'));
  const lines = Array.from(paths)
    .filter((p) => p.length > 0)
    .map((p) => `Add-MpPreference -ExclusionPath '${p.replace(/'/g, "''")}'`);
  return lines.join('\n');
}

/**
 * Write the whitelist script to a temp file and launch it elevated via
 * `powershell -Verb RunAs`. The user must confirm the UAC prompt.
 *
 * Returns true if the shellExecute call was issued (NOT whether the user
 * approved UAC — Windows doesn't tell us synchronously).
 */
export async function runDefenderWhitelistElevated(extraPaths: string[] = []): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  const script = buildDefenderWhitelistScript(extraPaths);
  const tmp = join(app.getPath('temp'), `snowluma-defender-whitelist-${Date.now()}.ps1`);
  const { writeFile } = await import('node:fs/promises');
  await writeFile(tmp, script, 'utf8');
  const psArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmp];
  // Use Start-Process to trigger UAC prompt with -Verb RunAs.
  const elevate = `Start-Process -FilePath 'powershell.exe' -ArgumentList '${psArgs.map((s) => s.replace(/'/g, "''")).join(' ')}' -Verb RunAs`;
  try {
    await execFileP('powershell', ['-NoProfile', '-NonInteractive', '-Command', elevate], {
      windowsHide: true,
      timeout: 60_000,
    });
    return true;
  } catch (err) {
    log.error(`defender whitelist elevation failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}
