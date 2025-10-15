import { BaseLayer, LayerType } from 'src/features/layer';
import { TranslationKey } from 'src/models/translation-key.model';

export interface VoxelLayer extends BaseLayer {
  type: LayerType.Voxel;

  url: string;

  unitLabel: TranslationKey | null;

  dataKey: string;

  noData: number;

  /**
   * The layer's value mapping.
   * This determines how the layer is rendered and otherwise displayed to the user.
   */
  mapping: VoxelLayerMapping;

  /**
   * The layer's value filter configuration.
   * This determines how the user is able to filter the layer's data points.
   */
  filter: VoxelLayerFilter;
}

export interface VoxelLayerMapping {
  /**
   * The minimum and maximum values of the layer's data points.
   */
  range: [number, number];

  /**
   * The sequence of colors applied to the range of values.
   * These will be scaled linearly to fit the value range.
   */
  colors: string[];
}

export interface VoxelLayerFilter {
  lithology: LithologyVoxelLayerFilter | null;
  conductivity: ConductivityVoxelLayerFilter | null;
}

export interface LithologyVoxelLayerFilter {
  /**
   * The key of the property that contains the lithology data points.
   */
  key: string;

  /**
   * The filter's items. Each item represents a value that can be filtered by.
   */
  items: LithologyVoxelLayerFilterItem[];
}

export interface LithologyVoxelLayerFilterItem {
  /**
   * The translation key providing the display name for the item.
   */
  label: TranslationKey;

  /**
   * The value that the data points matching this item have.
   */
  value: number;
}

export interface ConductivityVoxelLayerFilter {
  /**
   * The key of the property that contains the conductivity data points.
   */
  key: string;

  /**
   * The minimum and maximum values of the conductivity data points.
   */
  range: [number, number];
}
