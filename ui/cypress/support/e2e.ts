import 'cypress-real-events';

// Prevent Cesium's WebGL initialization errors from failing tests.
// In headless / GPU-less environments the browser may support WebGL in theory
// but fail to create a context, causing an unhandled promise rejection in
// CesiumWidget / Viewer.
Cypress.on('uncaught:exception', (err) => {
  if (
    err.message.includes('WebGL') ||
    err.message.includes('initialization failed')
  ) {
    return false; // suppress the error and let the test continue
  }
  // Let other errors fail the test as usual
});

beforeEach(() => {
  cy.intercept('GET', 'https://**.cesium.com/**', { log: false });
  cy.intercept('GET', 'https://**.geo.admin.ch/**', { log: false });
});
