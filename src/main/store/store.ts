import { app } from 'electron';
import { DEFAULT_STORE, type DesktopStoreSchema } from './schema';
import { JsonStore } from './json-store';

let instance: JsonStore<DesktopStoreSchema> | null = null;

export function getStore(): JsonStore<DesktopStoreSchema> {
  if (!instance) {
    instance = new JsonStore<DesktopStoreSchema>({
      cwd: app.getPath('userData'),
      name: 'config',
      defaults: DEFAULT_STORE,
    });
  }
  return instance;
}

export type Store = JsonStore<DesktopStoreSchema>;
