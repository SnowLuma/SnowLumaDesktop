/**
 * Cross-process types shared by main, preload, and renderer.
 *
 * NEVER import Node or Electron APIs here — this file must load cleanly in
 * the renderer's browser context.
 */

export interface AppInfo {
  name: string;
  version: string;
  electron: string;
  chrome: string;
  node: string;
  platform: NodeJS.Platform;
  arch: string;
  isPackaged: boolean;
}

export type WizardStep =
  | 'welcome'
  | 'network'
  | 'av'
  | 'core-download'
  | 'qq-detect'
  | 'add-bot'
  | 'prefs'
  | 'done';

export interface BotRecord {
  uin: string;
  /** User-chosen display name (14b iii). Empty string falls back to nickname. */
  customName: string;
  qqPath: string;
  /** 4b per-Bot: 'desktop' = Desktop manages QQ lifecycle; 'user' = user manages. */
  launchMode: 'desktop' | 'user';
  /** 4c per-Bot: whether to hide QQ main window after login. */
  hideQqWindowAfterLogin: boolean;
  createdAt: number;
}
