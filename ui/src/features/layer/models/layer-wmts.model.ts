import { BaseLayer, LayerType } from 'src/features/layer';
import type { Id } from 'src/models/id.model';

/**
 * A {@link Layer} that is sourced from swisstopo's [WMS](https://www.geo.admin.ch/de/wms-verfuegbare-dienste-und-daten)
 * or [WMTS](https://www.geo.admin.ch/de/wmts-verfuegbare-dienste-und-daten) service.
 */
export interface WmtsLayer extends BaseLayer {
  type: LayerType.Wmts;

  /**
   * A unique identifier for the layer. Will also be used as part of the translation key for the layer's display name.
   *
   * This is also the name that uniquely identifies the layer within the swisstopo WMTS API.
   */
  id: Id<this>;

  /**
   * The source of the layer (WMS or WMTS).
   */
  source: WmtsLayerSource;

  /**
   * The zoom level (zoomed in) from which on no higher resolution tiles will be fetched.
   * Instead, this level's tiles will be scaled up to fit higher zoom levels.
   */
  maxLevel: number | null;

  /**
   * The time steps available on this layer.
   * For layers with only a single time, this is `null`.
   */
  times: WmtsLayerTimes | null;

  /**
   * The mime type of the WM(T)S layer.
   * In most cases, this is `image/png`.
   */
  format: string;

  /**
   * The name of the organization or entity that the layer is attributed to.
   */
  credit: string;
}

export interface WmtsLayerTimes {
  /**
   * The currently selected time.
   */
  current: string;

  /**
   * The times available to the layer.
   */
  all: string[];
}

export enum WmtsLayerSource {
  WMS = 'WMS',
  WMTS = 'WMTS',
}
