import { BaseLayer, LayerType } from 'src/features/layer';

export interface Tiles3dLayer extends BaseLayer {
  type: LayerType.Tiles3d;

  /**
   * The layer's source, defining where the layer is loaded from.
   */
  source: Tiles3dLayerSource;

  /**
   * The order in which the layer's properties are sorted when displayed.
   * Keys that are left out will be sorted below any sorted ones, in default order.
   */
  orderOfProperties: string[];
}

export enum Tiles3dLayerSourceType {
  CesiumIon = 'CesiumIon',
  Earthquakes = 'Earthquakes',
}

export type Tiles3dLayerSource =
  | Tiles3dLayerSourceForCesium
  | Tiles3dLayerSourceForEarthquakes;

export interface Tiles3dLayerSourceForCesium {
  type: Tiles3dLayerSourceType.CesiumIon;

  /**
   * The id of the asset on Cesium Ion that represents the layer.
   */
  assetId: number;
}

export interface Tiles3dLayerSourceForEarthquakes {
  type: Tiles3dLayerSourceType.Earthquakes;

  /**
   * The url at which the earthquake file can be found.
   */
  url: string;
}
