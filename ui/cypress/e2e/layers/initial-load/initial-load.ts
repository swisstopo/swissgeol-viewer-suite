import { Then } from '@badeball/cypress-cucumber-preprocessor';

Then(
  /^the data displayed panel shows the grey topographic background map$/,
  () => {
    cy.get('ngm-layer-display-list-item:not([data-id])')
      .first()
      .as('layer-item')
      .should('be.visible')
      .as('bgItem');

    cy.get('@bgItem').shadow().find('[data-cy="background"]').click();

    cy.get('@bgItem')
      .shadow()
      .find('ngm-background-layer-select')
      .shadow()
      .find('ngm-background-layer-item[active]')
      .should('have.length', 1)
      .should('have.attr', 'data-layer', 'ch.swisstopo.pixelkarte-grau');
  },
);

Then(/^no other layers are displayed$/, () => {
  cy.get('ngm-layer-display-list-item[data-id]').should('not.exist');
});

Then(/^the entire background layer is visible$/, () => {
  // TODO Implement this, not sure what it should check - DVA 2025-07-30
});
