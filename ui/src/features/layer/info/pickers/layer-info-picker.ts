import { Cartesian3, Cartographic } from 'cesium';
import { LayerTreeNode } from 'src/layertree';
import { LayerInfo } from 'src/features/layer/info/layer-info.model';

export interface LayerInfoPicker {
  readonly layer: LayerTreeNode;

  /**
   * Picks a point on the layer and returns information about any hit objects.
   *
   * @param pick The picked location.
   * @return A promise resolving to an array of {@link LayerInfo} representing the picked objects.
   */
  pick(pick: LayerPickData): Promise<LayerInfo[]>;

  destroy(): void;
}

export interface LayerPickData {
  cartesian: Cartesian3;
  cartographic: Cartographic;
  distance: number;
}
