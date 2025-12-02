import { BaseLayer, LayerSource, LayerType } from 'src/features/layer';

export interface KmlLayer extends BaseLayer {
  type: LayerType.Kml;

  /**
   * The location of the KML file.
   */
  source: LayerSource | File;

  /**
   * Whether the KML's data should be clamped to the ground during loading.
   */
  shouldClampToGround: boolean;

  /**
   * The opacity of KML layers can't be changed.
   */
  canUpdateOpacity: false;
}
