import { EarthquakesLayer } from 'src/features/layer';
import { LayerInfoDrillPicker } from 'src/features/layer/info/pickers/layer-drill-picker';

export class LayerInfoPickerForEarthquakes extends LayerInfoDrillPicker<EarthquakesLayer> {
  get orderOfProperties(): string[] {
    return ['Time', 'Magnitude', 'Depthkm', 'EventLocationName', 'Details'];
  }
}
