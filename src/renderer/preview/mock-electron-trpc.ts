/**
 * Browser-only stub for the Electron preload's `window.electronTRPC` bridge.
 * Lets you load the renderer in a regular browser (no Electron) to look at
 * the UI. Activated by `?preview=1`.
 */

interface PreviewMessage {
  id: number;
  result: { type: 'data'; data: unknown };
}

interface PreviewListener {
  (msg: PreviewMessage): void;
}

const listeners: PreviewListener[] = [];

function mockResponse(path: string, _input?: unknown): unknown {
  switch (path) {
    case 'wizard.state':
      return { step: 'welcome', completedAt: null };
    case 'app.info':
      return {
        name: 'SnowLumaDesktop',
        version: '1.8.1',
        electron: '35.7.5',
        chrome: '128.0.0.0',
        node: '22.0.0',
        platform: 'win32',
        arch: 'x64',
        isPackaged: false,
      };
    case 'app.prefs.get':
      return {
        theme: 'system',
        language: 'zh-CN',
        autostartEnabled: false,
        autostartOpenMainWindow: false,
        trayHintShown: false,
      };
    case 'mirrors.list':
      return [
        {
          id: 'github',
          name: 'GitHub Releases',
          template: 'https://github.com/SnowLuma/SnowLuma/releases/download/{version}/{file}',
          priority: 100,
          enabled: true,
        },
        {
          id: 'mirror-jsdelivr',
          name: 'jsDelivr 镜像',
          template: 'https://cdn.jsdelivr.net/gh/SnowLuma/SnowLuma@{version}/{file}',
          priority: 80,
          enabled: false,
        },
      ];
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
      return 'main';
    case 'updater.check':
      return {
        available: true,
        channel: 'main',
        currentVersion: '1.8.1',
        latestVersion: '1.9.0',
        releaseNotes: '- fix(bridge): correctness pass on highway\n- feat(ui): new diagnostic export',
        releaseDate: new Date().toISOString(),
      };
    default:
      return null;
  }
}

export function installPreviewMock(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).electronTRPC = {
    sendMessage(envelope: { method: string; operation?: { id: number; path: string; input?: unknown } }) {
      if (envelope.method !== 'request' || !envelope.operation) return;
      const op = envelope.operation;
      const data = mockResponse(op.path, op.input);
      setTimeout(() => {
        const msg: PreviewMessage = {
          id: op.id,
          result: { type: 'data', data },
        };
        for (const cb of listeners) cb(msg);
      }, 12);
    },
    onMessage(cb: PreviewListener) {
      listeners.push(cb);
    },
  };
}

// Auto-install when imported as a side-effect at the top of main.tsx and
// either `?preview=1` is in the URL OR a previous load on this tab already
// activated preview mode (sticky sessionStorage flag, so the router can
// redirect without dragging the query string along).
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
