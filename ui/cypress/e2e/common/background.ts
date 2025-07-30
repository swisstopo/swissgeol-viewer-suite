import { Given } from '@badeball/cypress-cucumber-preprocessor';
import { ClientConfig } from '../../../src/api/client-config';

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
  cy.visit('/');
  cy.get('.cesium-widget > canvas', { timeout: 10_000 }).should('be.visible');
  cy.get('.ngm-menu', { timeout: 60_000 }).should('be.visible');
});

Given(/^the data panel is open$/, () => {
  cy.get('[data-cy=menu-item--data]').click();
  cy.get('ngm-navigation-panel', { timeout: 10_000 }).should('be.visible');
});
