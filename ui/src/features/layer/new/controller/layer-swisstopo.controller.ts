import { LayerController } from 'src/features/layer/new/controller/layer.controller';
import { SwisstopoLayer, SwisstopoLayerSource } from 'src/features/layer';
import {
  Credit,
  ImageryLayer,
  UrlTemplateImageryProvider,
  WebMapServiceImageryProvider,
} from 'cesium';
import {
  SWITZERLAND_RECTANGLE,
  WEB_MERCATOR_TILING_SCHEME,
} from 'src/constants';
import i18next from 'i18next';

/**
 * {@link SwisstopoLayerController} is the {@link LayerController} implementation for {@link SwisstopoLayer} instances.
 *
 * This controller's layer are displayed using {@link ImageryLayer},
 * which are added to `viewer.scene.imageryLayers`.
 */
export class SwisstopoLayerController extends LayerController<SwisstopoLayer> {
  /**
   * The imagery provider.
   *
   * This provider is responsible for fetching data for {@link layer}.
   *
   * @private
   */
  private provider!: SwisstopoImageryProvider;

  /**
   * The imagery layer created from {@link provider}.
   *
   * This is the value responsible for displaying the layer on the viewer.
   *
   * @private
   */
  private imagery!: ImageryLayer;

  protected override reactToChanges(): void {
    // These are the values that are statically references by the `provider`.
    // They can't be changed after the provider has been created, and require reinitialization.
    this.watch(this.layer.id);
    this.watch(this.layer.maxLevel);
    this.watch(this.layer.credit);
    this.watch(this.layer.format);

    // Apply opacity to the Cesium layer.
    this.watch(this.layer.opacity, (opacity) => {
      this.imagery.alpha = opacity;
    });

    // Show or hide the Cesium layer.
    this.watch(this.layer.isVisible, (isVisible) => {
      // Hiding the layer via `show = false` or removing it often leads to render errors,
      // probably due to some tile objects not being removed cleanly.
      // Instead, we simply make the layer fully opaque and disable its picking.

      if (isVisible) {
        this.imagery.alpha = this.layer.opacity;
        this.provider.enablePickFeatures = true;
      } else {
        this.imagery.alpha = 0;
        this.provider.enablePickFeatures = false;
      }
    });
  }

  protected override addToViewer(): void {
    // Create new instances of both the provider and layer.
    this.provider = this.makeProvider();
    const imagery = new ImageryLayer(this.provider, {
      show: this.layer.isVisible,
      alpha: this.layer.opacity,
    });

    const { imageryLayers } = this.viewer.scene;
    if (this.imagery === undefined) {
      // Add a new Cesium layer.
      imageryLayers.add(imagery);
    } else {
      // Replace an existing Cesium layer.
      const i = imageryLayers.indexOf(this.imagery);
      this.removeFromViewer();
      imageryLayers.add(imagery, i);
    }
    this.imagery = imagery;
  }

  /**
   * Remove both the {@link imagery} and the {@link provider} from the viewer.
   * @protected
   */
  protected override removeFromViewer(): void {
    this.removeLayerFromViewer();
    this.provider = undefined as unknown as SwisstopoImageryProvider;
  }

  /**
   * Remove the Cesium layer, but keep the {@link provider} intact.
   * @private
   */
  private removeLayerFromViewer(): void {
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

  /**
   * Creates a provider instance based on the layer's source type.
   * @private
   */
  private makeProvider(): SwisstopoImageryProvider {
    switch (this.layer.source) {
      case SwisstopoLayerSource.WMS:
        return this.makeProviderForWms();
      case SwisstopoLayerSource.WMTS:
        return this.makeProviderForWmts();
    }
  }

  private makeProviderForWms(): SwisstopoImageryProvider {
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

  private makeProviderForWmts(): SwisstopoImageryProvider {
    return new UrlTemplateImageryProvider({
      url: 'https://wmts.geo.admin.ch/1.0.0/{layer}/default/{timestamp}/3857/{z}/{x}/{y}.{format}',
      maximumLevel: this.layer.maxLevel ?? undefined,
      rectangle: SWITZERLAND_RECTANGLE,
      credit: new Credit(this.layer.credit),
      customTags: {
        layer: () => this.layer.id,
        format: () => this.layer.format.split('/')[1],
        timestamp: () => this.layer.dimension?.current ?? 'current',
      },
    });
  }
}

type SwisstopoImageryProvider =
  | WebMapServiceImageryProvider
  | UrlTemplateImageryProvider;
