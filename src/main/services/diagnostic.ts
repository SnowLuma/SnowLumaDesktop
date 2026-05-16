import { app, dialog } from 'electron';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { desktopLogsDir, dataRoot, coreRuntimeDir } from '../util/paths';
import { createLogger } from '../util/logger';
import { getStore } from '../store/store';
import { detectAv } from './av-detector';
import { detectQqInstall } from './qq-detector';

const log = createLogger('diagnostic');

/**
 * Build a self-contained .zip of everything a user needs to attach to a
 * bug report (6.1):
 *   - Desktop main log (last 7 days)
 *   - core stdout/stderr log
 *   - System info (OS, Electron, Node, arch)
 *   - QQ install info (path + version)
 *   - Defender / third-party AV status
 *   - Bot list with UINs hashed (sha256 first 8 chars) for privacy
 *   - Active mirror list + active core version
 */
export async function exportDiagnosticZip(saveTo?: string): Promise<string> {
  const target =
    saveTo ??
    (await dialog
      .showSaveDialog({
        title: '导出诊断报告',
        defaultPath: `snowluma-diagnostic-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`,
        filters: [{ name: 'Zip', extensions: ['zip'] }],
      })
      .then((r) => r.filePath ?? null));
  if (!target) throw new Error('user cancelled save dialog');

  const zip = new AdmZip();

  // ── Desktop logs (last 7 days) ──
  if (existsSync(desktopLogsDir())) {
    const entries = await readdir(desktopLogsDir());
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const entry of entries) {
      if (!entry.endsWith('.log')) continue;
      const full = join(desktopLogsDir(), entry);
      const match = entry.match(/desktop-(\d{4}-\d{2}-\d{2})\.log/);
      if (match) {
        const ts = Date.parse(match[1]!);
        if (Number.isFinite(ts) && ts < cutoff) continue;
      }
      const buf = await readFile(full).catch(() => null);
      if (buf) zip.addFile(`logs/desktop/${entry}`, buf);
    }
  }

  // ── Core runtime logs ──
  const coreLogs = join(coreRuntimeDir(), 'logs');
  if (existsSync(coreLogs)) {
    const entries = await readdir(coreLogs);
    for (const entry of entries) {
      const buf = await readFile(join(coreLogs, entry)).catch(() => null);
      if (buf) zip.addFile(`logs/core/${entry}`, buf);
    }
  }

  // ── System info ──
  const systemInfo = {
    appVersion: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    osRelease: process.getSystemVersion?.() ?? null,
    isPackaged: app.isPackaged,
  };
  zip.addFile('system.json', Buffer.from(JSON.stringify(systemInfo, null, 2)));

  // ── QQ + AV detection ──
  const [qq, av] = await Promise.all([
    detectQqInstall().catch(() => null),
    detectAv().catch(() => null),
  ]);
  zip.addFile('qq.json', Buffer.from(JSON.stringify(qq, null, 2)));
  zip.addFile('av.json', Buffer.from(JSON.stringify(av, null, 2)));

  // ── Desktop store snapshot (with UINs hashed) ──
  const store = getStore();
  const bots = store.get('bots');
  const hashedBots: Record<string, unknown> = {};
  const { createHash } = await import('node:crypto');
  for (const [uin, record] of Object.entries(bots)) {
    const hashed = createHash('sha256').update(uin).digest('hex').slice(0, 8);
    hashedBots[hashed] = {
      customName: record.customName.length > 0,
      qqPathExists: existsSync(record.qqPath),
      launchMode: record.launchMode,
      hideQqWindowAfterLogin: record.hideQqWindowAfterLogin,
      createdAt: record.createdAt,
    };
  }
  const storeSnapshot = {
    activeCoreVersion: store.get('activeCoreVersion'),
    installedCoreVersions: store.get('installedCoreVersions'),
    updateChannel: store.get('updateChannel'),
    autostartEnabled: store.get('autostartEnabled'),
    mirrors: store.get('mirrors').map((m) => ({
      id: m.id,
      name: m.name,
      enabled: m.enabled,
      priority: m.priority,
    })),
    botCount: Object.keys(bots).length,
    botsHashed: hashedBots,
    theme: store.get('theme'),
    language: store.get('language'),
  };
  zip.addFile('store.json', Buffer.from(JSON.stringify(storeSnapshot, null, 2)));

  // ── Data dir tree (paths only, sizes) for context ──
  const treeLines: string[] = [];
  await walkAndList(dataRoot(), '', treeLines, 3);
  zip.addFile('data-tree.txt', Buffer.from(treeLines.join('\n')));

  // ── README ──
  const readme = [
    'SnowLuma Desktop diagnostic export',
    `generated: ${new Date().toISOString()}`,
    `desktop: ${app.getVersion()}`,
    '',
    'Files:',
    '  system.json     — OS / Electron / Node info',
    '  qq.json         — detected QQ install',
    '  av.json         — Defender + third-party AV status',
    '  store.json      — Desktop config (UINs hashed)',
    '  data-tree.txt   — data dir layout',
    '  logs/desktop/   — Desktop main process logs (last 7d)',
    '  logs/core/      — core stdout/stderr logs',
    '',
    'No secrets are intentionally exported. Review before sharing.',
  ];
  zip.addFile('README.txt', Buffer.from(readme.join('\n')));

  await mkdir(join(target, '..').replace(/\\$/, ''), { recursive: true }).catch(() => {});
  await writeFile(target, zip.toBuffer());
  log.info(`diagnostic export saved to ${target}`);
  return target;
}

async function walkAndList(root: string, prefix: string, out: string[], depth: number): Promise<void> {
  if (depth <= 0) return;
  if (!existsSync(root)) return;
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const rel = join(prefix, entry.name);
    out.push(`${entry.isDirectory() ? 'D' : 'F'} ${rel}`);
    if (entry.isDirectory()) {
      await walkAndList(join(root, entry.name), rel, out, depth - 1);
    }
  }
}
