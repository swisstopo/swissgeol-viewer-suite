import type { Id } from 'src/models/id.model';
import type { Model } from 'src/models/model.model';
import { WmtsLayer, TiffLayer, BackgroundLayer } from 'src/features/layer';
import { Tiles3dLayer } from 'src/features/layer/models/layer-tiles3d.model';
import { VoxelLayer } from 'src/features/layer/models/layer-voxel.model';
import { TranslatedString } from 'src/models/translated-string.model';
import i18next from 'i18next';

export type Layer = WmtsLayer | Tiles3dLayer | VoxelLayer | TiffLayer;
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
   * Whether the layer has a legend, and how that legend can be found.
   *
   * - If this is `true`, the legend can be fetched as HTML from `geo.admin.ch` via the layer's id.
   * - If this is a `string`, the legend can be fetched as PNG from `geo.admin.ch` by using that string as id.
   * - If this is `null`, then the layer doesn't have a legend.
   *
   */
  legend: true | string | null;
}

export enum LayerType {
  Wmts = 'Wmts',
  Tiles3d = 'Tiles3d',
  Voxel = 'Voxel',
  Tiff = 'Tiff',
}

export const getLayerLabel = (layer: AnyLayer): string =>
  layer.label ?? i18next.t(`layers:layers.${layer.id}`);
