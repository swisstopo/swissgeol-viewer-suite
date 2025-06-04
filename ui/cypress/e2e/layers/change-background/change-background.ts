import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';
import {
  getBackgroundButton,
  getBackgroundSelect,
  getBackgroundSelector,
  hasViewerBackground,
  LAKES_AND_RIVERS_LAYER,
  ORTHOGRAPHIC_LAYER,
  TOPOGRAPHIC_LAYER,
} from './change-background.helpers';

Given(/^the topographic map is displayed in the 3D scene$/, () => {
  cy.get('.ngm-selected-map-container > ngm-background-layer-item').click();
  cy.get('ngm-background-layer-select')
    .shadow()
    .find('ul > li[role="button"]:nth-child(2)')
    .click();
  cy.get('ngm-background-layer-select + .ngm-close-icon').click();
  hasViewerBackground(TOPOGRAPHIC_LAYER);
});

Given(/^the layer panel is open$/, () => {
  cy.get('.ngm-menu > .ngm-menu-top:first-child > ngm-menu-item:first-child')
    .shadow()
    .find('.box')
    .click();
  cy.wait(1000);
  cy.get('ngm-layer-panel').then((it) => console.log(it, it.is(':visible')));
  cy.get('ngm-layer-panel').should('not.have.attr', 'hidden');
});

When(/^the user clicks on the background chip$/, () => {
  getBackgroundButton().click();
});

Then(/^the background switcher opens below the layer$/, () => {
  getBackgroundSelect().should('be.visible');
});

Then(/^the three options are displayed$/, () => {
  getBackgroundSelector(ORTHOGRAPHIC_LAYER).should('be.visible');
  getBackgroundSelector(TOPOGRAPHIC_LAYER).should('be.visible');
  getBackgroundSelector(LAKES_AND_RIVERS_LAYER).should('be.visible');
});

When(/^the user clicks on the orthographic thumpnail$/, () => {
  getBackgroundSelector(ORTHOGRAPHIC_LAYER).click();
});

When(/^the user clicks on the topographic thumbnail$/, () => {
  getBackgroundSelector(TOPOGRAPHIC_LAYER).click();
});

When(/^the user clicks on the rivers and lakes thumbnail$/, () => {
  getBackgroundSelector(LAKES_AND_RIVERS_LAYER).click();
});

Then(/^the background map changes to swissimage orthophoto$/, () => {
  hasViewerBackground(ORTHOGRAPHIC_LAYER);
});

Then(/^the background map changes to topographic map$/, () => {
  hasViewerBackground(TOPOGRAPHIC_LAYER);
});

Then(/^the background map changes to rivers and lakes$/, () => {
  hasViewerBackground(LAKES_AND_RIVERS_LAYER);
});

Then(/^the background switcher collapses$/, () => {
  getBackgroundSelect().should('not.exist');
});
