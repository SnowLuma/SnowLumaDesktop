import { app } from 'electron';
import { join } from 'node:path';

/**
 * Resolve Desktop data-related paths.
 *
 * Layout (Windows, see PLAN.md §"路径速查"):
 *   %APPDATA%/SnowLumaDesktop/
 *     ├─ core/versions/<ver>/   ← multi-version core binaries
 *     ├─ runtime/               ← core's CWD (config/, data/, logs/)
 *     ├─ bots/<UIN>/            ← per-Bot data (requires core PR)
 *     ├─ logs/                  ← Desktop main's own logs
 *     ├─ config.json            ← electron-store
 *     └─ .trash/                ← deferred delete (TG-style 5s undo)
 */
export function dataRoot(): string {
  // Electron's app.getPath('userData') already returns <appData>/<APP_NAME>
  // when productName matches APP_NAME; otherwise it derives from package.json's name.
  return app.getPath('userData');
}

export function coreVersionsDir(): string {
  return join(dataRoot(), 'core', 'versions');
}

export function coreRuntimeDir(): string {
  return join(dataRoot(), 'runtime');
}

export function botsDir(): string {
  return join(dataRoot(), 'bots');
}

export function botDir(uin: string): string {
  return join(botsDir(), uin);
}

export function desktopLogsDir(): string {
  return join(dataRoot(), 'logs');
}

export function trashDir(): string {
  return join(dataRoot(), '.trash');
}
