import { defineConfig } from 'vitest/config';

// Vitest loads configuration through a default export.
// eslint-disable-next-line import/no-default-export
export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      '@storage': new URL('./src/storage', import.meta.url).pathname,
      '@utils': new URL('./src/utils', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    restoreMocks: true,
    passWithNoTests: true,
  },
});
