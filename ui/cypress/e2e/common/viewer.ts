import { Viewer } from 'cesium';

export const getViewer = () => {
  return cy
    .get('ngm-app')
    .then((el) => (el[0] as any).cesiumService.viewer as Viewer);
};
