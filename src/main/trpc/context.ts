import type Store from 'electron-store';
import type { DesktopStoreSchema } from '../store/schema';
import { getStore } from '../store/store';
import { createLogger, type Logger } from '../util/logger';
import { getServices, type Services } from '../services';

export interface TrpcContext {
  store: Store<DesktopStoreSchema>;
  log: Logger;
  services: Services;
}

export function createContext(): TrpcContext {
  return {
    store: getStore(),
    log: createLogger('trpc'),
    services: getServices(),
  };
}
