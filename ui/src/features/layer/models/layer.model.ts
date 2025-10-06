import type { Id } from 'src/models/id.model';
import type { Model } from 'src/models/model.model';
import { BackgroundLayer, SwisstopoLayer, TiffLayer } from 'src/features/layer';
import { Tiles3dLayer } from 'src/features/layer/models/layer-tiles3d.model';
import { VoxelLayer } from 'src/features/layer/models/layer-voxel.model';
import { TranslatedString } from 'src/models/translated-string.model';

export type Layer =
  | BackgroundLayer
  | SwisstopoLayer
  | Tiles3dLayer
  | VoxelLayer
  | TiffLayer;

export interface BaseLayer extends Model {
  type: LayerType;

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
   * This value being `false` equates an {@link BaseLayer.opacity opacity} of 0.
   *
   * Note that "visibility" does not indicate the layer being active or not (i.e. selected by the user).
   * That property is not displayed on the layer object itself.
   */
  isVisible: boolean;

  /**
   * The id of this layer on https://geocat.ch, if available.
   */
  geocatId: string | null;

  /**
   * A url from which a representation of the layer can be downloaded.
   */
  downloadUrl: TranslatedString | null;
}

export enum LayerType {
  Background = 'Background',
  Swisstopo = 'Swisstopo',
  Tiles3d = 'Tiles3d',
  Voxel = 'Voxel',
  Tiff = 'Tiff',
}
