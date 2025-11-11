import { Given } from '@badeball/cypress-cucumber-preprocessor';
import type { ClientConfig } from '../../../src/api/client-config';
import type { Viewer } from 'cesium';

let cachedConfig: ClientConfig | null = null;

before(() => {
  cy.request('http://localhost:8000/api/client-config').then((res) => {
    cachedConfig = res.body;
  });
});

beforeEach(() => {
  cy.intercept('GET', 'http://localhost:8000/api/client-config', (req) => {
    req.reply(cachedConfig);
  });
});

Given(/^the viewer is fully loaded$/, () => {
  cy.visit('/?lang=en');
  cy.get('.cesium-widget > canvas', { timeout: 10_000 }).should('be.visible');
  cy.get('ngm-layout-sidebar', { timeout: 60_000 }).should('be.visible');
});

Given(/^the data panel is open$/, () => {
  cy.get('[data-cy=menu-item--data]').click();
  cy.get('ngm-navigation-panel', { timeout: 10_000 }).should('be.visible');
});

Given(/^the map has been loaded in$/, () => {
  // Wait for the first tile load.
  // This can take quite some time, sadly.
  cy.get('ngm-app').then({ timeout: 60_000 }, ($app) => {
    const { viewer } = $app[0] as unknown as { viewer: Viewer };
    return new Cypress.Promise((resolve) => {
      const handle = (count: number) => {
        if (count === 0) {
          viewer.scene.globe.tileLoadProgressEvent.removeEventListener(handle);
          resolve();
        }
      };
      viewer.scene.globe.tileLoadProgressEvent.addEventListener(handle);
    });
  });
});
