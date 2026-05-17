import { useEffect, useState } from 'react';
import type { SnowlumaPushEvent } from '@shared/ipc-protocol';

export interface DownloadProgressState {
  status: 'idle' | 'downloading' | 'done' | 'error';
  bytesDone: number;
  bytesTotal: number | null;
  speedBytesPerSec: number;
  mirrorId: string | null;
  attempt: number;
  error: string | null;
}

const INITIAL: DownloadProgressState = {
  status: 'idle',
  bytesDone: 0,
  bytesTotal: null,
  speedBytesPerSec: 0,
  mirrorId: null,
  attempt: 0,
  error: null,
};

/**
 * Subscribe to push events for a specific download id (e.g.
 * `core:v1.8.1`). Updates state on each progress tick — no polling,
 * just listens to whatever the main process emits.
 *
 * The `active` flag lets the caller reset state when the user opens a
 * fresh dialog (we go back to `idle` and zero out the bytes). It also
 * prevents an inactive component from accumulating stale `error`
 * states from a previous run.
 */
export function useDownloadProgress(id: string | null, active: boolean): DownloadProgressState {
  const [state, setState] = useState<DownloadProgressState>(INITIAL);

  useEffect(() => {
    if (!active || !id) {
      setState(INITIAL);
      return;
    }
    const bridge = globalThis.window?.snowlumaIpc;
    if (!bridge?.onEvent) return;
    const dispose = bridge.onEvent((event: SnowlumaPushEvent) => {
      if (event.id !== id) return;
      if (event.kind === 'download:progress') {
        setState({
          status: 'downloading',
          bytesDone: event.bytesDone,
          bytesTotal: event.bytesTotal,
          speedBytesPerSec: event.speedBytesPerSec,
          mirrorId: event.mirrorId,
          attempt: event.attempt,
          error: null,
        });
      } else if (event.kind === 'download:done') {
        setState((prev) => ({
          ...prev,
          status: 'done',
          bytesDone: event.bytesTotal,
          bytesTotal: event.bytesTotal,
          speedBytesPerSec: 0,
          error: null,
        }));
      } else if (event.kind === 'download:error') {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: event.message,
          speedBytesPerSec: 0,
        }));
      }
    });
    return dispose;
  }, [id, active]);

  return state;
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return '';
  return `${formatBytes(bytesPerSec)}/s`;
}
