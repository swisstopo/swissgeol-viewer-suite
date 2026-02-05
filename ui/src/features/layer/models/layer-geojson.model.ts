import { BaseLayer, LayerSource, LayerType } from 'src/features/layer';

export interface GeoJsonLayer extends BaseLayer {
  type: LayerType.GeoJson;

  source: LayerSource;

  /**
   * The source for the layer's terrain.
   * If this is `null`, the GeoJson is draped directly onto the default terrain.
   */
  terrain: LayerSource | null;

  /**
   * Whether the GeoJson's data should be clamped to the ground during loading.
   */
  shouldClampToGround: boolean;

  canUpdateOpacity: true;

  /**
   * The order in which the layer's properties are sorted when displayed.
   * Keys that are left out will be sorted below any sorted ones, in default order.
   */
  orderOfProperties: string[];

  layerStyle: LayerStyle | null;
}

export interface VectorOptions {
  type: 'circle' | 'triangle' | 'square';
  radius: number;
  rotation?: number;
  fill?: { color?: string };
  stroke?: { color?: string; width?: number };
}

export interface LayerStyle {
  type: 'unique';
  property: string;
  values: Array<{
    geomType: 'point';
    value: string | number;
    vectorOptions: VectorOptions;
  }>;
}
