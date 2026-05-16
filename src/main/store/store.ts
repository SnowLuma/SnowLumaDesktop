import Store from 'electron-store';
import { DEFAULT_STORE, type DesktopStoreSchema } from './schema';

let instance: Store<DesktopStoreSchema> | null = null;

export function getStore(): Store<DesktopStoreSchema> {
  if (!instance) {
    instance = new Store<DesktopStoreSchema>({
      name: 'config',
      defaults: DEFAULT_STORE,
      clearInvalidConfig: false,
    });
  }
  return instance;
}
