import { LayerController } from 'src/features/layer/new/controller/layer.controller';
import { SwisstopoLayer, SwisstopoLayerSource } from 'src/features/layer';
import { firstValueFrom } from 'rxjs';
import { WmtsService } from 'src/services/wmts.service';
import {
  Credit,
  ImageryLayer,
  ImageryProvider,
  WebMapServiceImageryProvider,
} from 'cesium';
import {
  SWITZERLAND_RECTANGLE,
  WEB_MERCATOR_TILING_SCHEME,
} from 'src/constants';
import i18next from 'i18next';

export class SwisstopoLayerController extends LayerController<SwisstopoLayer> {
  private imagery: ImageryLayer | null = null;

  protected register() {
    this.watch(this.layer.id);
    this.watch(this.layer.format);
    this.watch(this.layer.maxLevel);
    this.watch(this.layer.credit);
    this.watch(this.layer.dimension);

    this.watch(this.layer.opacity, (opacity) => {
      this.imagery!.alpha = opacity;
    });
  }

  protected addToViewer() {
    const provider = this.makeProvider();
    const imagery = new ImageryLayer(provider, {
      alpha: this.layer.opacity,
    });

    if (this.imagery === null) {
      this.viewer.imageryLayers.add(imagery);
    } else {
      const i = this.viewer.imageryLayers.indexOf(this.imagery);
      this.removeFromViewer();
      this.viewer.imageryLayers.add(i, imagery);
    }
    this.imagery = imagery;
  }

  protected removeFromViewer() {
    if (this.imagery === null) {
      return;
    }
    this.viewer.imageryLayers.remove(this.imagery, true);
    this.imagery = null;
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
