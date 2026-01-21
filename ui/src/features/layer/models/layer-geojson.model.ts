import { BaseLayer, LayerSource, LayerType } from 'src/features/layer';

export interface GeoJsonLayer extends BaseLayer {
  type: LayerType.GeoJson;

  source: LayerSource;

  /**
   * Whether the GeoJson's data should be clamped to the ground during loading.
   */
  shouldClampToGround: boolean;

  canUpdateOpacity: true;
}
