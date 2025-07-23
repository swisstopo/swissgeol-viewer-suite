import ObjectSelector from './ObjectSelector';
import { Cartesian2, Cartographic, Scene, Viewer } from 'cesium';
import { lv95ToDegrees } from '../projection';
import QueryStore from '../store/query';

export default class QueryManager {
  objectSelector: ObjectSelector;
  viewer: Viewer;
  scene: Scene;
  enabled = true;

  constructor(viewer) {
    this.objectSelector = new ObjectSelector(viewer);
    this.viewer = viewer;
    this.scene = viewer.scene;
  }

  async selectTile(feature) {
    const x = getProperty(feature, /\w*XCOORD/);
    const y = getProperty(feature, /\w*YCOORD/);
    const z = getProperty(feature, /\w*ZCOORDB/);
    if (!x || !y || !z) return; // boreholes only solution for now
    const coords = lv95ToDegrees([x, y]);
    const cartographicCoords = Cartographic.fromDegrees(
      coords[0],
      coords[1],
      z,
    );
    const position = Cartographic.toCartesian(cartographicCoords);
    const attributes = this.objectSelector.pickAttributes(
      Cartesian2.ZERO,
      position,
      feature,
    );

    this.showObjectInformation(attributes);
    if (attributes?.zoom) attributes.zoom();

    this.scene.requestRender();
  }

  showObjectInformation(attributes) {
    QueryStore.setObjectInfo(attributes);
  }

  hideObjectInformation() {
    QueryStore.setObjectInfo(undefined);
  }
}

function getProperty(feature, pattern) {
  const key = feature.getPropertyIds().find((value) => pattern.test(value));
  if (key) {
    return feature.getProperty(key);
  }
}
