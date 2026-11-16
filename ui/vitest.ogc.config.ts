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
    alias: [
      // Fomantic components are jQuery-based UI scripts irrelevant to node unit
      // tests and crash on load (no jQuery/window); stub them out.
      {
        find: /fomantic-ui-css\/.*\.js$/,
        replacement: resolve(__dirname, './src/test/empty.ts'),
      },
      { find: 'src', replacement: resolve(__dirname, './src') },
    ],
  },
});
