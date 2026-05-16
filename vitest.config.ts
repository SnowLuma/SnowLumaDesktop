import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/main/**/*.ts'],
      exclude: ['src/main/index.ts', 'src/main/window.ts', 'src/main/tray.ts'],
    },
  },
  resolve: {
    alias: {
      '@main': resolve(root, 'src/main'),
      '@renderer': resolve(root, 'src/renderer'),
      '@shared': resolve(root, 'src/shared'),
      '@snowluma/ui': resolve(root, '../../packages/ui/src/index.ts'),
    },
  },
});
