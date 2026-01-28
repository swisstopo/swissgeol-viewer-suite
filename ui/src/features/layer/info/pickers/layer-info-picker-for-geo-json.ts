import { LayerInfoDrillPicker } from 'src/features/layer/info/pickers/layer-drill-picker';
import { GeoJsonLayer } from 'src/features/layer/models/layer-geojson.model';

export class LayerInfoPickerForGeoJson extends LayerInfoDrillPicker<GeoJsonLayer> {
  get orderOfProperties(): string[] {
    return this.layer.orderOfProperties;
  }
}
