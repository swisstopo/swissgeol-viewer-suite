import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { getViewer } from '../../common/viewer';

When(/^the user clicks on the 2d control$/, () => {
  cy.get('control-2d').click();
});

Then(/^the map is in 3d mode$/, () => {
  getViewer().then(async (viewer) => {
    const cameraController = viewer.scene.screenSpaceCameraController;
    expect(cameraController.lookEventTypes).to.not.be.empty;
    expect(cameraController.tiltEventTypes).to.not.be.empty;
    expect(cameraController.enableCollisionDetection).to.be.false;
  });
});

Then(/^the map is in 2d mode$/, () => {
  getViewer().then(async (viewer) => {
    const cameraController = viewer.scene.screenSpaceCameraController;
    expect(cameraController.lookEventTypes).to.be.empty;
    expect(cameraController.tiltEventTypes).to.be.empty;
    expect(cameraController.enableCollisionDetection).to.be.true;
  });
});

Then(/^the 2d control shows the 3d icon$/, () => {
  cy.get('control-2d')
    .shadow()
    .find('ngm-core-icon')
    .should('exist')
    .should('have.attr', 'icon', '3d');
});

Then(/^the 2d control shows the 2d icon$/, () => {
  cy.get('control-2d')
    .shadow()
    .find('ngm-core-icon')
    .should('exist')
    .should('have.attr', 'icon', '2d');
});
