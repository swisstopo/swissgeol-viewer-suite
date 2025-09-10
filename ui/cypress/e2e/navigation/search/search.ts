import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';

Given(/^the search input is focused$/, () => {
  cy.get('ngm-navigation-search')
    .as('search')
    .shadow()
    .find('input')
    .as('searchInput')
    .focus();

  cy.get('@search').shadow().find('ul').as('searchResults').should('exist');
});

When(/^the query "([^"]*)" is entered$/, (query: string) => {
  cy.get('@searchInput').type(query);
});
Then(/^the results contain the "([^"]*)" layer$/, (layer: string) => {
  cy.get('@searchResults')
    .should('be.visible')
    .find(`li > [data-cy="${layer}"]`)
    .should('exist');
});
