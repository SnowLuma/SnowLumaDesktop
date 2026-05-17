import { BrowserWindow } from 'electron';
import { SNOWLUMA_EVENT_CHANNEL, type SnowlumaPushEvent } from '@shared/ipc-protocol';

/**
 * Fire-and-forget push-event broadcaster. Sends to every renderer
 * currently alive. Used for download progress and any other
 * long-running task that wants real-time UI updates without the
 * renderer polling — see PLAN: "更新这个不要轮询" / "no polling".
 *
 * Safe to call before any window exists; the loop is a no-op then.
 */
export function broadcastEvent(event: SnowlumaPushEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    try {
      win.webContents.send(SNOWLUMA_EVENT_CHANNEL, event);
    } catch {
      /* dead webContents — ignore */
    }
  }
}
