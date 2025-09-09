import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';

Given(/^one layer is being displayed$/, () => {
  cy.get(
    'ngm-layer-catalog-item[data-cy="layer-ch.swisstopo.geologie-geocover"]',
  )
    .shadow()
    .find('ngm-core-checkbox')
    .shadow()
    .find('label')
    .click({ force: true });

  cy.get('ngm-layer-display-list-item[data-id]')
    .first()
    .as('layer-item')
    .should('be.visible');
});

When(/^the user hovers over a layer in the data displayed section$/, () => {
  cy.get('@layer-item').realHover();
});

Then(/^the background of the layer will be highlighted$/, () => {
  cy.get('@layer-item').should(
    'have.css',
    'background-color',
    'rgb(248, 251, 252)',
  );
});

When(/^the user hovers over the eye icon$/, () => {
  cy.get('@layer-item')
    .shadow()
    .find('[data-cy="visibility"]')
    .shadow()
    .find('button')
    .as('icon')
    .realHover();
});

Then(/^the icon will be highlighted$/, () => {
  cy.get('@icon').should('have.css', 'background-color', 'rgb(214, 226, 230)');
});

When(/^the user hovers over the opacity chip$/, () => {
  cy.get('@layer-item')
    .shadow()
    .find('[data-cy="opacity"]')
    .as('chip')
    .shadow()
    .find('button')
    .as('chip-button')
    .realHover();
});

Then(/^the the background of the chip will be highlighted$/, () => {
  cy.get('@chip-button').should(
    'have.css',
    'background-color',
    'rgb(214, 226, 230)',
  );
});

Then(/^a tooltip will be displayed$/, () => {
  cy.get('@chip').then((chip$) => {
    cy.get('ngm-core-tooltip-box')
      .filter((_, el) => el['target'] === chip$[0])
      .should('have.class', 'is-visible');
  });
});

When(/^the user hovers over the context menu$/, () => {
  cy.get('@layer-item')
    .shadow()
    .find('ngm-core-button.actions')
    .shadow()
    .find('button')
    .as('icon')
    .realHover();
});
