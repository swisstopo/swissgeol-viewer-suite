import { LayerController } from 'src/features/layer/new/controller/layer.controller';
import { SwisstopoLayer, SwisstopoLayerSource } from 'src/features/layer';
import {
  Credit,
  ImageryLayer,
  ImageryLayerCollection,
  ImageryProvider,
  UrlTemplateImageryProvider,
  WebMapServiceImageryProvider,
} from 'cesium';
import {
  SWITZERLAND_RECTANGLE,
  WEB_MERCATOR_TILING_SCHEME,
} from 'src/constants';
import i18next from 'i18next';
// Who calls destroy()?
const _destroy = ImageryLayer.prototype.destroy;
ImageryLayer.prototype.destroy = function () {
  console.log('[ImageryLayer.destroy]', this);
  return _destroy.apply(this, arguments);
};

// Who removes from the collection?
const _remove = ImageryLayerCollection.prototype.remove;
ImageryLayerCollection.prototype.remove = function (layer, destroy) {
  console.log('[ImageryLayerCollection.remove]', layer, { destroy });
  return _remove.apply(this, arguments);
};

export class SwisstopoLayerController extends LayerController<SwisstopoLayer> {
  private imagery!: ImageryLayer;

  protected override register(): void {
    this.watch(this.layer.id);
    this.watch(this.layer.maxLevel);
    this.watch(this.layer.credit);
    this.watch(this.layer.format);

    this.watch(this.layer.opacity, (opacity) => {
      this.imagery.alpha = opacity;
    });

    this.watch(this.layer.isVisible, (isVisible) => {
      const off = this.viewer.scene.postRender.addEventListener(() => {
        off();
        if (
          !this.imagery.isDestroyed() &&
          this.viewer.scene.imageryLayers.contains(this.imagery)
        ) {
          this.imagery.show = isVisible;
        }
      });
      this.viewer.scene.requestRender();
    });
  }

  protected override addToViewer(): void {
    const provider = this.makeProvider();
    const imagery = new ImageryLayer(provider, {
      alpha: this.layer.opacity,
    });

    if (this.imagery === undefined) {
      this.viewer.scene.imageryLayers.add(imagery);
    } else {
      const i = this.viewer.imageryLayers.indexOf(this.imagery);
      this.removeFromViewer();
      this.viewer.imageryLayers.add(imagery, i);
    }
    this.imagery = imagery;
  }

  protected override removeFromViewer(): void {
    const imagery = this.imagery;
    if (imagery === undefined) {
      return;
    }
    try {
      this.viewer.scene.imageryLayers.remove(imagery, true);
    } catch (e) {
      // For some reason, removing an imagery can lead to an error about its tiles already being destroyed.
      // There doesn't seem to be a way to circumvent or detect this (`imagery.isDestroyed()` is `false`),
      // so we just catch the error and move on.
      if (!String(e).startsWith('DeveloperError: This object was destroyed,')) {
        throw e;
      }
    }
    this.imagery = undefined as unknown as ImageryLayer;
  }

  override zoomIntoView(): void {
    this.viewer.flyTo(this.imagery);
  }

  private makeProvider(): ImageryProvider {
    switch (this.layer.source) {
      case SwisstopoLayerSource.WMS:
        return this.makeProviderForWms();
      case SwisstopoLayerSource.WMTS:
        return this.makeProviderForWmts();
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

  private makeProviderForWmts(): ImageryProvider {
    return new UrlTemplateImageryProvider({
      url: 'https://wmts.geo.admin.ch/1.0.0/{layer}/default/{timestamp}/3857/{z}/{x}/{y}.{format}',
      maximumLevel: this.layer.maxLevel ?? undefined,
      rectangle: SWITZERLAND_RECTANGLE,
      credit: new Credit(this.layer.credit),
      customTags: {
        layer: () => this.layer.id,
        format: () => this.layer.format,
        timestamp: () => this.layer.dimension?.current ?? 'current',
      },
    });
  }
}
