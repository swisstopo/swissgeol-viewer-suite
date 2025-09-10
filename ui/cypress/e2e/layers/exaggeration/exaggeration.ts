import { Then, When } from '@badeball/cypress-cucumber-preprocessor';

When(/^the settings tab is selected$/, () => {
  cy.get('ngm-layer-tabs').shadow().find('button[data-cy="options"]').click();
  cy.get('ngm-layer-tabs')
    .shadow()
    .find('div[data-cy="options"]')
    .should('be.visible');
});

Then(/^the exaggeration slider is shown$/, () => {
  cy.get('ngm-layer-options')
    .shadow()
    .find('ngm-core-slider[data-cy="exaggeration-slider"]')
    .should('be.visible');
});
Then(/^the exaggeration is at a factor of (.+)x$/, (factor: string) => {
  cy.get('ngm-layer-options')
    .shadow()
    .find('ngm-core-chip[data-cy="exaggeration-factor"]')
    .should('have.text', `${factor}x`);
});

When(/^the exaggeration slider is set to (.+)$/, (valueAsString: string) => {
  const value = Number(valueAsString);
  if (isNaN(value)) {
    throw new Error(`Invalid adjustment: ${value}`);
  }

  cy.get('ngm-core-slider[data-cy="exaggeration-slider"]')
    .find('input')
    .as('slider')
    .then(($slider) => {
      const step = Number($slider.attr('step') ?? -1);
      expect(step).to.equal(0.5);

      const min = Number($slider.attr('min') ?? -1);
      expect(min).to.equal(1);

      const max = Number($slider.attr('max') ?? -1);
      expect(max).to.equal(10);
    });

  cy.get('@slider').invoke('val', value).trigger('input').trigger('change');
});
