import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';

Given(/^no cursor info is shown$/, () => {
  cy.get('ngm-layout-cursor-info').should('not.be.visible');
});

When(/^the cursor is moved over the map$/, () => {
  cy.get('.cesium-viewer')
    .find('canvas')
    .realHover({
      // This position is adjusted so that the top_oom layer will be hovered by it.
      position: {
        x: 920,
        y: 426,
      },
    });
});

When(/^the (.+) layer has been activated$/, (layer: string) => {
  cy.get(`[data-cy="layer-${layer}"]`, { timeout: 10_000 })
    .shadow()
    .find('ngm-core-checkbox')
    .shadow()
    .find('label')
    .click({ force: true });
});

When(/^the terrain is hidden$/, () => {
  cy.get('ngm-layer-display-list')
    .shadow()
    .find('> ngm-layer-display-list-item:last-child')
    .shadow()
    .find('ngm-core-button[data-cy="visibility"]')
    .click({ force: true });
});

Then(/^the (terrain|object) height is shown$/, (terrainOrObject) => {
  cy.get('ngm-layout-cursor-info').as('info').should('be.visible');

  cy.get('@info').shadow().find('[data-cy="height-info"]').as('height-info');

  // The canvas doesn't render correctly in headless mode, which makes this test impossible to pass.
  if (Cypress.browser.isHeadless) {
    return;
  }

  const expectedText =
    terrainOrObject === 'terrain'
      ? 'Terrain elevation (m AMSL)'
      : 'Object elevation (m AMSL)';

  cy.get('@height-info').find('label').should('contain.text', expectedText);
});
