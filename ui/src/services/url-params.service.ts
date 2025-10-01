import { Cartesian3 } from 'cesium';
import { BaseService } from 'src/utils/base.service';

export class UrlParamsService extends BaseService {}

interface UrlParams {
  /**
   * The ids of all active layers.
   */
  layers: string[];

  /**
   * The visibilities of all {@link layers}.
   */
  layers_visibility: boolean[];

  /**
   * The transparencies of all {@link layers}, from 0 to 1.
   *
   * Note that "transparency" is the opposite of opacity.
   * The equation `opacity = 1 - transparency` holds.
   */
  layers_transparency: number[];

  /**
   * The WMTS timestamps of all {@link layers}.
   * For layers without time travel, this is always set to `"current"`.
   */
  layers_timestamp: string[];

  /**
   * The access token with which custom cesium ion assets were loaded.
   */
  ionToken: string;

  /**
   * The ids of custom cesium ion asset layers.
   */
  ionAssetIds: string[];

  /**
   * The id of the selected background layer.
   */
  map: string;

  /**
   * The transparency of the background layer.
   */
  map_transparency: number;

  zoom_to: [number, number, number];

  slice: { type: string; negate: boolean; slicePoints: Cartesian3[] };

  target: { long: `${number}`; lat: `${number}`; height: `${number}` };

  topicId: string;

  projectId: string;

  viewId: string;

  zExaggeration: number;
}
