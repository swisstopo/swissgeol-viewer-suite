import { defineConfig } from 'cypress';
import * as fs from 'node:fs';
import { addCucumberPreprocessorPlugin } from '@badeball/cypress-cucumber-preprocessor';
import { default as createBundler } from '@bahmutov/cypress-esbuild-preprocessor';

//@ts-expect-error module does not have typings
import { createEsbuildPlugin } from '@badeball/cypress-cucumber-preprocessor/esbuild';

// https://github.com/badeball/cypress-cucumber-preprocessor/blob/master/examples/esbuild-ts/cypress.config.ts
const setupNodeEvents = async (
  on: Cypress.PluginEvents,
  config: Cypress.PluginConfigOptions,
): Promise<Cypress.PluginConfigOptions> => {
  const cucumberConfig = JSON.parse(
    fs.readFileSync('.cypress-cucumber-preprocessorrc.json', 'utf-8')
  );

  await addCucumberPreprocessorPlugin(on, {
    ...config,
    ...cucumberConfig,
  });
  on(
    'file:preprocessor',
    createBundler({
      plugins: [createEsbuildPlugin(config)],
    }),
  );
  return config;
}


export default defineConfig({
  e2e: {
    setupNodeEvents,
    baseUrl: 'http://localhost:8000',
    watchForFileChanges: true,
    supportFile: false,
    specPattern: 'cypress/e2e/**/*.feature',
    screenshotsFolder: 'cypress/screenshots',
    videosFolder: 'cypress/videos',
    downloadsFolder: 'cypress/downloads',
    fixturesFolder: 'cypress/fixtures',
  },
  reporter: 'junit',
  reporterOptions: {
    mochaFile: 'cypress/results/assets-test-output-[hash].xml',
    toConsole: true,
    attachments: true,
  },
  video: false,
});
