import type { BotRecord, WizardStep } from '@shared/types';
import type { QqCompatManifest } from '../services/qq-compat';

export interface DesktopStoreSchema {
  /** Wizard progress (12b). */
  wizardStep: WizardStep;
  wizardCompletedAt: number | null;
  /** One-time UX flags. */
  trayHintShown: boolean;
  /** 11d autostart preference + behaviour. */
  autostartEnabled: boolean;
  autostartOpenMainWindow: boolean;
  /** Bot records keyed by UIN; ordered list of UINs preserves Sidebar order. */
  bots: Record<string, BotRecord>;
  botOrder: string[];
  /** core version control (7b). */
  activeCoreVersion: string | null;
  installedCoreVersions: string[];
  updateChannel: 'main' | 'dev';
  /** 7d download-source mirror list (UI-managed CRUD + priority). */
  mirrors: MirrorEntry[];
  /** 6c webui credentials Desktop generated for auto-token injection. */
  webuiCredentials: { username: string; password: string } | null;
  /** UI prefs. */
  theme: 'light' | 'dark' | 'system';
  language: 'zh-CN' | 'en-US';
  /** QQ compatibility manifest cache (Phase 0.3 / 7c). */
  qqCompatCache: {
    manifest: QqCompatManifest;
    fetchedAt: number;
  } | null;
  /** Last detected QQ install (4a-iv). */
  qqInstall: {
    path: string;
    version: string | null;
    detectedAt: number;
  } | null;
}

export interface MirrorEntry {
  id: string;
  name: string;
  /** Template URL with `{version}` / `{file}` placeholders. */
  template: string;
  priority: number;
  enabled: boolean;
}

export const DEFAULT_STORE: DesktopStoreSchema = {
  wizardStep: 'welcome',
  wizardCompletedAt: null,
  trayHintShown: false,
  autostartEnabled: false,
  autostartOpenMainWindow: false,
  bots: {},
  botOrder: [],
  activeCoreVersion: null,
  updateChannel: 'main',
  // Priority: smaller wins. 0 = first tried, larger = fallback. The
  // built-in GitHub mirror starts at 0 so a clean install defaults to it.
  mirrors: [
    {
      id: 'github',
      name: 'GitHub Releases',
      template: 'https://github.com/SnowLuma/SnowLuma/releases/download/{version}/{file}',
      priority: 0,
      enabled: true,
    },
  ],
  webuiCredentials: null,
  theme: 'system',
  language: 'zh-CN',
  installedCoreVersions: [],
  qqCompatCache: null,
  qqInstall: null,
};
