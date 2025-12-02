import { Tiles3dLayer } from 'src/features/layer';
import { LayerInfoDrillPicker } from 'src/features/layer/info/pickers/layer-drill-picker';

export class LayerInfoPickerForTiles3d extends LayerInfoDrillPicker<Tiles3dLayer> {
  get orderOfProperties(): string[] {
    return this.layer.orderOfProperties;
  }
}
