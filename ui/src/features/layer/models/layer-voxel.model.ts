import { BaseLayer, LayerSource, LayerType } from 'src/features/layer';
import { TranslationKey } from 'src/models/translation-key.model';

export interface VoxelLayer extends BaseLayer {
  type: LayerType.Voxel;

  source: LayerSource;

  dataKey: string;

  values: {
    noData: number;
    undefined: number;
  };

  /**
   * The layer's value mapping.
   * This determines how the layer can be rendered and otherwise displayed to the user.
   */
  mappings: VoxelLayerMapping[];

  /**
   * How the {@link mappings} are joined together to hide or show specific datapoints.
   */
  filterOperator: FilterOperator;
}

/**
 * List of operator that can join together filters.
 */
export enum FilterOperator {
  /**
   * Require all mappings to match for a datapoint to be shown.
   */
  And = 'And',

  /**
   * Require at least one mapping to match for a datapoint to be shown.
   */
  Or = 'Or',

  /**
   * Require exactly one mapping to match for a datapoint to be shown.
   */
  Xor = 'Xor',
}

export const VOXEL_UNDEFINED_COLOR = Object.freeze([204, 204, 204]);

export type VoxelLayerMapping = VoxelItemMapping | VoxelRangeMapping;

export enum VoxelLayerMappingType {
  Item = 'Item',
  Range = 'Range',
}

export interface VoxelItemMapping {
  type: VoxelLayerMappingType.Item;

  /**
   * The key of the property that contains the data points.
   */
  key: string;

  /**
   * The mapping's items. Each item represents a unique value.
   */
  items: VoxelItemMappingItem[];
}

export interface VoxelItemMappingItem {
  /**
   * The translation key providing the display name for the item.
   */
  label: TranslationKey;

  /**
   * The value that the data points matching this item have.
   */
  value: number;

  /**
   * The color in which this value is displayed.
   */
  color: string;

  /**
   * Whether the item is currently enabled.
   * This signifies that the item's datapoints match the mapping.
   */
  isEnabled: boolean;
}

export interface VoxelRangeMapping {
  type: VoxelLayerMappingType.Range;

  /**
   * The key of the property that contains the data points.
   */
  key: string;

  /**
   * The minimum and maximum values of the data points.
   */
  range: [number, number];

  /**
   * The colors with which the range is displayed.
   */
  colors: string[];

  /**
   * The range of currently enabled values.
   * Datapoints outside this range do not match the mapping.
   */
  enabledRange: [number, number];

  /**
   * Whether undefined values always match, independent from {@link enabledRange}.
   */
  isUndefinedAlwaysEnabled: boolean;
}
