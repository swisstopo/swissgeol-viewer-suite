import type { Id } from 'src/models/id.model';
import type { Model } from 'src/models/model.model';
import type {
  BackgroundLayer,
  EarthquakesLayer,
  TiffLayer,
  WmtsLayer,
} from 'src/features/layer';
import { Tiles3dLayer } from 'src/features/layer/models/layer-tiles3d.model';
import { VoxelLayer } from 'src/features/layer/models/layer-voxel.model';
import { TranslatedString } from 'src/models/translated-string.model';
import i18next from 'i18next';
import {
  makeTranslationKey,
  TranslationKey,
} from 'src/models/translation-key.model';
import { KmlLayer } from 'src/features/layer/models/layer-kml.model';
import { GeoJsonLayer } from 'src/features/layer/models/layer-geojson.model';

export type Layer =
  | WmtsLayer
  | Tiles3dLayer
  | VoxelLayer
  | TiffLayer
  | KmlLayer
  | GeoJsonLayer
  | EarthquakesLayer;

export type AnyLayer = Layer | BackgroundLayer;

export interface BaseLayer extends Model {
  type: LayerType | 'Background';

  /**
   * A unique identifier for the layer. Will also be used as part of the translation key for the layer's display name.
   */
  id: Id<this>;

  /**
   * A fixed name for this label.
   *
   * This value is mainly set for layers that are imported by the user,
   * and thus do not have a translated name available.
   *
   * Note that if there are locale-dependent versions of this value,
   * it is the responsibility of whatever part of the application that has
   * imported the layer to ensure that the value gets updated when the language changes.
   */
  label: string | null;

  /**
   * The layer's opacity, ranging from 0 to 1.
   *
   * If the value is 0, {@link BaseLayer.isVisible isVisible} will be  `false`.
   * If the layer {@link BaseLayer.canUpdateOpacity does not support opacity changes}, this value can only be 0 or 1.
   */
  opacity: number;

  /**
   * Whether this layer's opacity can be changed.
   * If `false`, {@link BaseLayer.opacity opacity} will always be `1`.
   */
  canUpdateOpacity: boolean;

  /**
   * Whether the layer is currently visible on the viewer's map.
   * This value will always be `false` when {@link BaseLayer.opacity opacity} is 0.
   *
   * Note that "visibility" does not indicate the layer being active or not (i.e. selected by the user),
   * although inactive layers generally have a visibility of `false.
   * Layer activeness is not displayed on the layer object itself.
   */
  isVisible: boolean;

  /**
   * The id of this layer on https://geocat.ch, if available.
   */
  geocatId: string | null;

  /**
   * An url from which a representation of the layer can be downloaded.
   */
  downloadUrl: TranslatedString | null;

  /**
   * Configuration for the layer's info box.
   *
   * If `null`, the layer has no info box.
   */
  infoBox: InfoBox | null;

  /**
   * A mapping of custom properties that should be appended to each pick info on the layer.
   */
  customProperties: Record<string, string>;

  /**
   * Whether the layer is local-only, i.e. relies on the current browser or client.
   * If this is `true`, it indicates that the layer should not be shared via permalinks and the likes.
   */
  isLocal?: boolean;
}

export enum LayerType {
  Wmts = 'Wmts',
  Tiles3d = 'Tiles3d',
  Voxel = 'Voxel',
  Tiff = 'Tiff',
  Kml = 'Kml',
  Earthquakes = 'Earthquakes',
  GeoJson = 'GeoJson',
}

/**
 * Configuration for the layer's info box.
 *
 * Two modes are available:
 *
 * - `wms`: The legend is fetched as HTML from `geo.admin.ch` via the layer's id.
 * - `custom`: Displays translated info text (derived from the layer id), an optional URL,
 *   and optional key-value pairs (`information`). The key is a translation key and the
 *   value is a string or a markdown link `[text](url)`.
 */
export type InfoBox = InfoBoxWms | InfoBoxCustom;

export interface InfoBoxWms {
  type: 'wms';
}

export interface InfoBoxCustom {
  type: 'custom';
  legendUrl?: string;
  information?: Record<string, string>;
}

export const getLayerLabel = (layer: AnyLayer): string =>
  layer.label ?? i18next.t(`layers:layers.${layer.id}`);

export const getLayerAttributeName = (
  layer: Pick<AnyLayer, 'id' | 'type'>,
  attribute: string,
): string =>
  i18next.t(getTranslationKeyForLayerAttributeName(layer, attribute));

export const getTranslationKeyForLayerAttributeName = (
  layer: Pick<AnyLayer, 'id' | 'type'>,
  attribute: string,
): TranslationKey =>
  makeTranslationKey(
    `layers:properties.${layer.id}.${attribute}`,
    `layers:properties.${layer.type}.${attribute}`,
    `layers:properties.${attribute}`,
  );
