import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';
import { run } from '../../../../src/utils/fn.utils';

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
  cy.get('@searchResults', { timeout: 30_000 })
    .should('be.visible')
    .find(`li > [data-cy="${layer}"]`)
    .should('exist');
});

Then(/^all search results contain the string "([^"]*)"$/, (string: string) => {
  cy.get('@searchResults')
    .find('li')
    .each(($item) => {
      expect($item).to.contain.text(string);
    });
});

Then(/^there (?:is|are) (\d+) search result$/, (countString: number) => {
  const count = Number(countString);

  cy.get('@searchResults').find('li').should('have.length', count);
});

Then(/^the results contain all three item types in the correct order$/, () => {
  cy.get('@searchResults')
    .find('li')
    .then(($items) => {
      let currentCategory: 'location' | 'geoadmin' | 'catalog' = 'location';
      const remainingCategories = new Set(['location', 'geoadmin', 'catalog']);

      const nextCategoryMapping = {
        location: 'catalog',
        catalog: 'geoadmin',
        geoadmin: null,
      };

      $items.each((_i, item) => {
        const category = run(() => {
          if (item.querySelector('.is-location') != null) {
            return 'location';
          }
          if (item.querySelector('.is-geoadmin-layer') != null) {
            return 'geoadmin';
          }
          return 'catalog';
        });
        remainingCategories.delete(category);

        // Still the same category, which is always valid.
        if (category === currentCategory) {
          return;
        }

        // It's the next category.
        const nextCategory = nextCategoryMapping[currentCategory];
        if (nextCategory !== null && category === nextCategory) {
          currentCategory = category;
          return;
        }

        if (nextCategory === null) {
          expect(category).to.equal(currentCategory);
        } else {
          expect(category).to.be.oneOf([currentCategory, nextCategory]);
        }
      });

      expect(remainingCategories).to.have.lengthOf(
        0,
        'The results should have contained at least one of each category of items',
      );
    });
});
