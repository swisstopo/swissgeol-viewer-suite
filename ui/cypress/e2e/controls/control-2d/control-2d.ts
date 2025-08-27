import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { Viewer } from 'cesium';

When(/^the user clicks on the 2d control$/, () => {
  cy.get('controls-2d-action').click();
});

Then(/^the map is in 3d mode$/, () => {
  cy.get('ngm-app').then(async (app$) => {
    const { viewer } = app$[0] as unknown as { viewer: Viewer };
    const cameraController = viewer.scene.screenSpaceCameraController;
    expect(cameraController.lookEventTypes).to.not.be.empty;
    expect(cameraController.tiltEventTypes).to.not.be.empty;
    expect(cameraController.enableCollisionDetection).to.be.false;
  });
});

Then(/^the map is in 2d mode$/, () => {
  cy.get('ngm-app').then(async (app$) => {
    const { viewer } = app$[0] as unknown as { viewer: Viewer };
    const cameraController = viewer.scene.screenSpaceCameraController;
    expect(cameraController.lookEventTypes).to.be.empty;
    expect(cameraController.tiltEventTypes).to.be.empty;
    expect(cameraController.enableCollisionDetection).to.be.true;
  });
});

Then(/^the 2d control shows the 3d icon$/, () => {
  cy.get('controls-2d-action')
    .shadow()
    .find('ngm-core-icon')
    .should('exist')
    .should('have.attr', 'icon', '3d');
});

Then(/^the 2d control shows the 2d icon$/, () => {
  cy.get('controls-2d-action')
    .shadow()
    .find('ngm-core-icon')
    .should('exist')
    .should('have.attr', 'icon', '2d');
});
