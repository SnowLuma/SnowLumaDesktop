import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

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

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: resolve(root, 'src/main/index.ts'),
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
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: resolve(root, 'src/preload/index.ts'),
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
