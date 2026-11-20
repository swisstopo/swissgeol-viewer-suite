import babel from '@rolldown/plugin-babel';
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const panelElements = /[/\\](?:core-element|layer-info-list)\.element\.ts$/;

export default defineConfig({
  oxc: { exclude: panelElements },
  plugins: [
    // Node does not parse the decorators used by the Lit Info panel.
    babel({
      include: panelElements,
      plugins: [
        ['@babel/plugin-transform-typescript', { allowDeclareFields: true }],
        [
          '@babel/plugin-proposal-decorators',
          { decoratorsBeforeExport: true, version: '2023-05' },
        ],
      ],
    }),
  ],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.ogc.test.ts', 'node_modules'],
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      src: resolve(__dirname, './src'),
    },
  },
});
