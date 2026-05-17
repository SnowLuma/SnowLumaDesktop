import { useEffect, useState } from 'react';
import type { SnowlumaPushEvent } from '@shared/ipc-protocol';

export interface WindowState {
  maximized: boolean;
  focused: boolean;
}

const INITIAL: WindowState = { maximized: false, focused: true };

/**
 * Mirror the main-process window state into the renderer. Main pushes
 * `window:state` events on maximize / unmaximize / focus / blur (see
 * src/main/window.ts) so the custom titlebar can re-render the
 * maximize glyph and dim the controls when the window isn't focused.
 */
export function useWindowState(): WindowState {
  const [state, setState] = useState<WindowState>(INITIAL);

  useEffect(() => {
    const bridge = globalThis.window?.snowlumaIpc;
    if (!bridge?.onEvent) return;
    return bridge.onEvent((event: SnowlumaPushEvent) => {
      if (event.kind !== 'window:state') return;
      setState({ maximized: event.maximized, focused: event.focused });
    });
  }, []);

  return state;
}
