import { app } from 'electron';
import { getStore } from '../store/store';
import { createLogger } from '../util/logger';

const log = createLogger('autostart');

const HIDDEN_FLAG = '--hidden';

/**
 * Apply the user's autostart preference to the OS. The companion CLI flag
 * (`--hidden`) is consumed by the renderer/main on launch to decide whether
 * to surface the main window (11d).
 */
export function applyAutostartPreference(): void {
  const store = getStore();
  const enabled = store.get('autostartEnabled');
  const openMain = store.get('autostartOpenMainWindow');
  const args = openMain ? [] : [HIDDEN_FLAG];
  app.setLoginItemSettings({
    openAtLogin: enabled,
    args,
  });
  log.info(`autostart enabled=${enabled} openMainOnStart=${openMain}`);
}

export function wasLaunchedHidden(): boolean {
  return process.argv.includes(HIDDEN_FLAG);
}

export const AUTOSTART_HIDDEN_FLAG = HIDDEN_FLAG;
