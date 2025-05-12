beforeEach(() => {
  cy.intercept('GET', 'https://**.cesium.com/**', { log: false });
  cy.intercept('GET', 'https://**.geo.admin.ch/**', { log: false });
});
