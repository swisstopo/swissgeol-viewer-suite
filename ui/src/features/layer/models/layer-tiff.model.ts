import { BaseLayer, LayerType } from './layer.model';

export interface TiffLayer extends BaseLayer {
  type: LayerType.Tiff;

  /**
   * The url at which the tiff can be accessed.
   */
  url: string;

  /**
   * The width and height of each of the TIFF's cells, in meters.
   */
  cellSize: number;

  /**
   * The tiff's bands.
   */
  bands: TiffLayerBand[];
}

export interface TiffLayerBand {
  /**
   * The band's index within the TIFF.
   */
  index: number;

  /**
   * The band's name.
   */
  name: string;

  /**
   * The unit of the band's values.
   */
  unit: TiffLayerUnit | null;

  /**
   * The band's display configuration, defining how the band is rendered.
   * If is this left out, then the band can't be displayed individually.
   */
  display: TiffLayerConfigDisplay | null;
}

export interface TiffLayerConfigDisplay {
  /**
   * The lower and upper bounds of displayed values.
   *
   * This configuration is used mainly for calculating the band's legend and tooltips.
   * Values in the band may fall outside of this range without causing any issue.
   *
   * If the layer's legend should be rendered in descending order,
   * the lower and upper bound are switched.
   */
  bounds: [number, number];

  /**
   * The value that represents the absence of data on this band.
   * Tiles matching that value will not be rendered.
   *
   * Leave this value empty to not hide any undefined values.
   */
  noData: number | null;

  /**
   * The steps displayed in the tiff's legend.
   */
  steps: TiffLayerBandStep[];

  /**
   * The name of the color map with which the tiff is rendered.
   */
  colorMap: string;

  /**
   * Whether each of the band's values is discrete.
   *
   * When this is set to `true`, it is assumed that all values of the band are defined within {@link steps},
   * and there is no interpolation necessary between steps.
   */
  isDiscrete: boolean;
}

export interface TiffLayerBandStep {
  value: number;
  label: string;
}

export enum TiffLayerUnit {
  Meters = 'Meters',
  MetersAboveSeaLevel = 'MetersAboveSeaLevel',
}
