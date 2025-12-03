import { BaseLayer, LayerSource, LayerType } from 'src/features/layer';

export interface EarthquakesLayer extends BaseLayer {
  type: LayerType.Earthquakes;

  /**
   * The location of the earthquakes file.
   */
  source: LayerSource;
}
