import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

// Separate configuration for OGC tests that must be run explicitly
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.ogc.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      src: resolve(__dirname, './src'),
    },
  },
});
