import { CoreManager } from './core-manager';
import { BotManager } from './bot-manager';
import { DesktopUpdater } from './updater';

export interface Services {
  core: CoreManager;
  bots: BotManager;
  updater: DesktopUpdater;
}

let services: Services | null = null;

export function initServices(): Services {
  if (services) return services;
  const core = new CoreManager();
  const bots = new BotManager(core);
  const updater = new DesktopUpdater();
  services = { core, bots, updater };
  return services;
}

export function getServices(): Services {
  if (!services) throw new Error('services not initialised; call initServices() during app.whenReady');
  return services;
}
