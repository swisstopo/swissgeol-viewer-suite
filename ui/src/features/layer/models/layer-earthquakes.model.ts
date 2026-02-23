import {
  BaseLayer,
  LayerSource,
  LayerType,
  OgcSource,
} from 'src/features/layer';

export interface EarthquakesLayer extends BaseLayer {
  type: LayerType.Earthquakes;

  /**
   * The location of the earthquakes file.
   */
  source: LayerSource;

  ogcSource: OgcSource | null;
}
