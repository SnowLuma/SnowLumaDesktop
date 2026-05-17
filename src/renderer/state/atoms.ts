import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { BotRecord, WizardStep } from '@shared/types';

/** UI-only ephemeral state. Persisted state lives in electron-store. */

export const themeAtom = atom<'light' | 'dark' | 'system'>('system');
export const languageAtom = atom<'zh-CN' | 'en-US'>('zh-CN');

export const wizardStepAtom = atom<WizardStep>('welcome');

export const activeBotUinAtom = atom<string | null>(null);

export const trashEntriesAtom = atom<
  Array<{ uin: string; trashEntry: string; record: BotRecord; expiresAt: number }>
>([]);

/** Sidebar collapse state. Lives in localStorage so it survives reloads
 * without round-tripping through electron-store on every toggle. */
export const navSidebarCollapsedAtom = atomWithStorage<boolean>('sl.nav-sidebar.collapsed', false);
export const botSidebarCollapsedAtom = atomWithStorage<boolean>('sl.bot-sidebar.collapsed', false);
