import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(import.meta.url);
const pkg = require('./package.json') as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

// Build a closed list of modules main / preload must `require()` at
// runtime instead of inlining: every production dep, every electron-*
// dev dep (electron itself plus a couple of toolkit packages that drag
// the npm-electron helper code in), and any deep sub-paths thereof.
//
// We do this BOTH through electron-vite's plugin AND directly in
// rollupOptions.external because vite 8's rolldown bundler doesn't
// always honour the plugin's `config` hook for this field.
const runtimeExternals = Array.from(
  new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    'electron',
    'electron-devtools-installer',
  ]),
);
const externalMatcher = [
  ...runtimeExternals,
  new RegExp(`^(${runtimeExternals.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})/.+`),
];

const sharedAlias = {
  '@shared': resolve(root, 'src/shared'),
};

// `@snowluma/ui` is resolved through node_modules (pnpm `link:` to
// packages/ui). We intentionally DO NOT alias it to source — Tailwind 4's
// vite plugin uses Vite's resolver to follow CSS `@import` statements, and
// pointing the alias at index.ts breaks `@import "@snowluma/ui/styles/theme.css"`.
// Tradeoff: edits to packages/ui require `pnpm build` there to surface in
// Desktop's bundle. TS types still resolve via tsconfig `paths` for IDE
// autocomplete against source.

// Force CJS output for main + preload. Electron's `electron` module is
// CJS and exposes a context-dependent surface (ipcMain in main only,
// ipcRenderer in renderer/preload only). An ESM `import { ipcRenderer }
// from 'electron'` is checked statically and fails on the side where
// that name isn't exported — crashed packaged builds with:
//   "SyntaxError: ... does not provide an export named 'ipcRenderer'"
// CJS `const { ipcRenderer } = require('electron')` just yields undefined
// for missing names, which is what the trpc bridge / electron-toolkit
// actually expect at runtime.
const cjsOutput = {
  format: 'cjs' as const,
  entryFileNames: '[name].cjs',
};

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ include: ['electron'] })],
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: resolve(root, 'src/main/index.ts'),
        external: externalMatcher,
        output: cjsOutput,
      },
    },
    resolve: {
      alias: {
        '@main': resolve(root, 'src/main'),
        ...sharedAlias,
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ include: ['electron'] })],
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: resolve(root, 'src/preload/index.ts'),
        external: externalMatcher,
        output: cjsOutput,
      },
    },
    resolve: {
      alias: {
        '@preload': resolve(root, 'src/preload'),
        ...sharedAlias,
      },
    },
  },
  renderer: {
    root: resolve(root, 'src/renderer'),
    plugins: [react(), tailwindcss()],
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: resolve(root, 'src/renderer/index.html'),
      },
    },
    resolve: {
      alias: {
        '@renderer': resolve(root, 'src/renderer'),
        ...sharedAlias,
      },
    },
    server: {
      port: 5173,
    },
  },
});
