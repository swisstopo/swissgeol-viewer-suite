import { Viewer } from 'cesium';

export const getViewer = () =>
  cy.get('ngm-app').then((el) => (el[0] as any).viewer as Viewer);
