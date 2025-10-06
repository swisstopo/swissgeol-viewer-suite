import { LayerController } from 'src/features/layer/new/controller/layer.controller';
import { SwisstopoLayer, SwisstopoLayerSource } from 'src/features/layer';
import { firstValueFrom } from 'rxjs';
import { WmtsService } from 'src/services/wmts.service';
import { Credit, ImageryProvider, WebMapServiceImageryProvider } from 'cesium';
import {
  SWITZERLAND_RECTANGLE,
  WEB_MERCATOR_TILING_SCHEME,
} from 'src/constants';
import i18next from 'i18next';

export class SwisstopoLayerController extends LayerController<SwisstopoLayer> {
  protected async addToViewer() {
    const wmtsService = await firstValueFrom(WmtsService.inject());

    const layer = await firstValueFrom(wmtsService.layer$(this.layer.id));
    if (layer === null) {
      throw new Error(`Unknown WMS/WMTS layer: ${this.layer.id}`);
    }
  }

  private makeProvider(): ImageryProvider {
    switch (this.layer.source) {
      case SwisstopoLayerSource.WMS:
        return this.makeProviderForWms();
      case SwisstopoLayerSource.WMTS:
        break;
    }
  }

  private makeProviderForWms(): ImageryProvider {
    return new WebMapServiceImageryProvider({
      url: 'https://wms{s}.geo.admin.ch?version=1.3.0',
      crs: 'EPSG:4326',
      parameters: {
        FORMAT: this.layer.format,
        TRANSPARENT: true,
        LANG: i18next.language,
      },
      subdomains: '0123',
      tilingScheme: WEB_MERCATOR_TILING_SCHEME,
      layers: String(this.layer.id),
      maximumLevel: this.layer.maxLevel ?? undefined,
      rectangle: SWITZERLAND_RECTANGLE,
      credit: new Credit(this.layer.credit),
    });
  }
}
