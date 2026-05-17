/**
 * Browser-only stub for `window.snowlumaIpc`. Lets us load the renderer
 * in a regular browser (no Electron preload) to look at the UI.
 * Activated by `?preview=1` and sticky via sessionStorage so internal
 * redirects don't drop preview state.
 */
import type { IpcTrpcRequest, IpcTrpcResponse } from '@shared/ipc-protocol';

const previewState: {
  prefs: {
    theme: 'light' | 'dark' | 'system';
    language: 'zh-CN' | 'en-US';
    autostartEnabled: boolean;
    autostartOpenMainWindow: boolean;
    trayHintShown: boolean;
  };
  updateChannel: 'main' | 'dev';
  mirrors: Array<{ id: string; name: string; template: string; priority: number; enabled: boolean }>;
} = {
  prefs: {
    theme: 'system',
    language: 'zh-CN',
    autostartEnabled: false,
    autostartOpenMainWindow: false,
    trayHintShown: false,
  },
  updateChannel: 'main',
  mirrors: [
    {
      id: 'github',
      name: 'GitHub Releases',
      template: 'https://github.com/SnowLuma/SnowLuma/releases/download/{version}/{file}',
      priority: 0,
      enabled: true,
    },
    {
      id: 'mirror-jsdelivr',
      name: 'jsDelivr 镜像',
      template: 'https://cdn.jsdelivr.net/gh/SnowLuma/SnowLuma@{version}/{file}',
      priority: 50,
      enabled: false,
    },
  ],
};

function mockResponse(path: string, input?: unknown): unknown {
  switch (path) {
    case 'wizard.state':
      return { step: 'welcome', completedAt: null };
    case 'app.info':
      return {
        name: 'SnowLumaDesktop',
        version: '1.8.1',
        electron: '35.7.5',
        chrome: '134.0.0.0',
        node: '22.16.0',
        platform: 'win32',
        arch: 'x64',
        isPackaged: false,
      };
    case 'app.prefs.get':
      return { ...previewState.prefs };
    case 'app.prefs.set':
      Object.assign(previewState.prefs, (input ?? {}) as object);
      return undefined;
    case 'mirrors.list':
      return previewState.mirrors;
    case 'mirrors.upsert': {
      const m = input as { id: string; name: string; template: string; priority: number; enabled: boolean };
      const i = previewState.mirrors.findIndex((x) => x.id === m.id);
      if (i >= 0) previewState.mirrors[i] = { ...m };
      else previewState.mirrors.push({ ...m });
      return m;
    }
    case 'mirrors.delete': {
      const id = (input as { id: string }).id;
      previewState.mirrors = previewState.mirrors.filter((m) => m.id !== id);
      return undefined;
    }
    case 'av.detect':
      return {
        defender: { status: 'running', realtimeProtection: true, amServiceEnabled: true },
        thirdParty: [{ name: '360 Total Security', processName: '360tray.exe' }],
      };
    case 'qq.cached':
    case 'qq.detect':
      return {
        path: 'C:\\Program Files\\Tencent\\QQNT\\QQ.exe',
        version: '9.9.20.0',
        detectedAt: Date.now(),
      };
    case 'qq.compat.evaluate':
      return { kind: 'unknown', warn: false };
    case 'core.versions.list':
      return { installed: ['v1.8.1'], active: 'v1.8.1' };
    case 'core.versions.remote':
      return {
        releases: [
          {
            tag: 'v1.9.0',
            name: 'SnowLuma v1.9.0',
            prerelease: false,
            publishedAt: new Date(Date.now() - 86400_000).toISOString(),
            assets: [{ name: 'SnowLuma-v1.9.0-win-x64.zip', size: 90_000_000 }],
          },
          {
            tag: 'v1.8.1',
            name: 'SnowLuma v1.8.1',
            prerelease: false,
            publishedAt: new Date(Date.now() - 7 * 86400_000).toISOString(),
            assets: [{ name: 'SnowLuma-v1.8.1-win-x64.zip', size: 88_000_000 }],
          },
          {
            tag: 'nightly-abc1234',
            name: 'SnowLuma nightly 1.9.0-dev.abc1234',
            prerelease: true,
            publishedAt: new Date(Date.now() - 3600_000).toISOString(),
            assets: [{ name: 'SnowLuma-v1.9.0-dev.abc1234-win-x64.zip', size: 91_000_000 }],
          },
        ],
        latestTag: 'v1.9.0',
      };
    case 'core.state':
      return {
        status: 'running',
        activeVersion: 'v1.8.1',
        webuiPort: 5099,
        pid: 12345,
        crashStreak: 0,
        changedAt: new Date().toISOString(),
        recentOutput: [
          '[stdout] [Hook] discovered QQ.exe pid=4321',
          '[stdout] [Bridge] online uin=12345678',
          '[stdout] [OneBot] ws server listening on 0.0.0.0:8081',
        ],
      };
    case 'core.webuiUrl':
      return { url: null, ready: false };
    case 'bot.list':
      return [
        {
          uin: '12345678',
          customName: '老板号',
          qqPath: 'C:\\Program Files\\Tencent\\QQNT\\QQ.exe',
          launchMode: 'desktop',
          hideQqWindowAfterLogin: true,
          createdAt: Date.now() - 86400_000,
        },
        {
          uin: '87654321',
          customName: '测试号',
          qqPath: 'C:\\Program Files\\Tencent\\QQNT\\QQ.exe',
          launchMode: 'user',
          hideQqWindowAfterLogin: false,
          createdAt: Date.now() - 3600_000,
        },
      ];
    case 'bot.states':
      return [
        {
          uin: '12345678',
          status: 'online',
          qqPid: 4321,
          crashStreak: 0,
          changedAt: new Date().toISOString(),
          lastError: null,
        },
        {
          uin: '87654321',
          status: 'offline',
          qqPid: null,
          crashStreak: 0,
          changedAt: new Date().toISOString(),
          lastError: null,
        },
      ];
    case 'bot.import.findOrphans':
      return [];
    case 'updater.channel':
      return previewState.updateChannel;
    case 'updater.setChannel':
      previewState.updateChannel = ((input as { channel?: 'main' | 'dev' })?.channel ?? 'main');
      return undefined;
    case 'updater.check':
      return {
        available: true,
        channel: 'main',
        currentVersion: '1.8.1',
        latestVersion: '1.9.0',
        releaseNotes: '- fix(bridge): correctness pass on highway\n- feat(ui): new diagnostic export',
        releaseDate: new Date().toISOString(),
        downloadUrl: 'https://github.com/SnowLuma/SnowLumaDesktop/releases/latest',
      };
    default:
      return null;
  }
}

export function installPreviewMock(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).snowlumaIpc = {
    async request(req: IpcTrpcRequest): Promise<IpcTrpcResponse> {
      await new Promise((r) => setTimeout(r, 8));
      try {
        const data = mockResponse(req.path, req.input);
        return { ok: true, data };
      } catch (err) {
        return {
          ok: false,
          error: { message: err instanceof Error ? err.message : String(err), code: 'INTERNAL_SERVER_ERROR' },
        };
      }
    },
    // Browser preview never receives real push events — return a noop
    // unsubscribe to keep `useDownloadProgress` happy.
    onEvent(_listener: (event: unknown) => void): () => void {
      void _listener;
      return () => {};
    },
    // Custom titlebar window controls. In browser preview the
    // window-control commands don't go anywhere — log and move on so
    // the bar still renders without erroring.
    window: {
      send(cmd: string): void {
        // eslint-disable-next-line no-console
        console.info(`[preview] window cmd ignored: ${cmd}`);
      },
    },
  };
}

if (typeof window !== 'undefined') {
  const url = new URLSearchParams(window.location.search);
  const sticky = window.sessionStorage?.getItem('sl-preview') === '1';
  if (url.has('preview') || sticky) {
    try {
      window.sessionStorage?.setItem('sl-preview', '1');
    } catch {
      /* private mode etc — ignore */
    }
    installPreviewMock();
  }
}
