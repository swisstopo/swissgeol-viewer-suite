import { BaseLayer, LayerSource, LayerType } from 'src/features/layer';

export interface Tiles3dLayer extends BaseLayer {
  type: LayerType.Tiles3d;

  /**
   * The layer's source, defining where the layer is loaded from.
   */
  source: LayerSource;

  /**
   * The order in which the layer's properties are sorted when displayed.
   * Keys that are left out will be sorted below any sorted ones, in default order.
   */
  orderOfProperties: string[];
}
