import {
  Cartesian3,
  Cartographic,
  ImageryLayer,
  Math as CesiumMath,
  Resource,
  UrlTemplateImageryProvider,
  Viewer,
  WebMercatorTilingScheme,
} from 'cesium';
import { GeoTIFFLayer, GeoTIFFLayerBand, LayerConfig } from 'src/layertree';
import { SWITZERLAND_RECTANGLE, TITILER_BY_PAGE_HOST } from 'src/constants';
import { Observable, Subject } from 'rxjs';

export class LayerTiffController {
  private active!: ActiveBand;

  private readonly pickSubject = new Subject<PickData>();

  constructor(
    private readonly layer: LayerConfig & GeoTIFFLayer,
    private readonly viewer: Viewer,
  ) {
    if (layer.controller !== undefined) {
      throw new Error(`GeoTIFFLayer is already controlled: ${layer.label}`);
    }
    if (layer.bands.length === 0) {
      throw new Error(
        "Can't control GeoTIFFLayer as it has no bands configured",
      );
    }
    Object.assign(layer, {
      controller: this,
      setVisibility: this.setVisibility,
      setOpacity: this.setOpacity,
      add: this.addToViewer,
      remove: this.removeFromViewer,
    });
    this.activateBand(layer.bands[0].index);
  }

  get activeBand(): GeoTIFFLayerBand {
    return this.active.band;
  }

  get pick$(): Observable<PickData> {
    return this.pickSubject.asObservable();
  }

  activateBand(index: number): void {
    const band = this.layer.bands.find((it) => it.index === index);
    if (band == null) {
      throw new Error(`Band with index does not exist: ${index}`);
    }

    let oldImageryIndex = -1;
    if (this.active != null) {
      oldImageryIndex =
        this.viewer.scene.imageryLayers.indexOf(this.active.imagery) ?? -1;
      this.viewer.scene.imageryLayers.remove(this.active.imagery);
    }

    const imagery = this.makeImagery(band);
    this.active = { imagery, band };
    if (oldImageryIndex !== -1) {
      this.addToViewer(oldImageryIndex);
    }
    this.viewer.scene.requestRender();
  }

  async pick(cartesian: Cartesian3): Promise<boolean> {
    if (!this.layer.visible) {
      return false;
    }

    const coords = Cartographic.fromCartesian(cartesian);
    const longitude = CesiumMath.toDegrees(coords.longitude);
    const latitude = CesiumMath.toDegrees(coords.latitude);

    interface Json {
      coordinates: [number, number];
      values: Array<number | null>;
      band_names: string[];
    }

    const url = `http://localhost:8481/cog/point/${longitude},${latitude}?url=${this.layer.url}`;
    const json: Json = await Resource.fetchJson({ url });
    try {
      const activeValue = json.values[this.active.band.index - 1];
      if (activeValue === null) {
        return false;
      }
      this.pickSubject.next({
        layer: this.layer,
        coordinates: cartesian,
        bands: json.values,
      });
      return true;
    } catch (e) {
      console.error(`failed to pick geoTIFF ${this.layer.id}`, e);
      return false;
    }
  }

  private makeImagery(band: GeoTIFFLayerBand): LayerTiffImagery {
    const noDataParam =
      band.display?.noData === undefined ? '' : '&nodata={nodata}';
    const provider = new UrlTemplateImageryProvider({
      url: `${TITILER_BY_PAGE_HOST[window.location.host]}/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url={url}&rescale={min},{max}&bidx={bidx}&colormap_name={colormap}${noDataParam}`,
      customTags: {
        url: () => this.layer.url,
        bidx: () => band.index,
        colormap: () => band.display!.colorMap,
        min: () => band.display!.bounds[0],
        max: () => band.display!.bounds[1],
        nodata: () => band.display!.noData,
      },
      rectangle: SWITZERLAND_RECTANGLE,
      tilingScheme: new WebMercatorTilingScheme(),
      enablePickFeatures: true,
      hasAlphaChannel: true,
    });
    provider.errorEvent.addEventListener(() => {
      // Suppress error logs
    });
    const imagery = new ImageryLayer(provider, {
      alpha: this.layer.opacity ?? 1,
      show: this.layer.visible ?? true,
    });
    return Object.assign(imagery, {
      controller: this,
    });
  }

  private readonly addToViewer = (toIndex: number) => {
    const layersLength = this.viewer.scene.imageryLayers.length;
    if (toIndex > 0 && toIndex < layersLength) {
      const imageryIndex = layersLength - toIndex;
      this.viewer.scene.imageryLayers.add(this.active.imagery, imageryIndex);
      return;
    }
    this.viewer.scene.imageryLayers.add(this.active.imagery);
  };

  private readonly removeFromViewer = (): void => {
    this.viewer.scene.imageryLayers.remove(this.active.imagery, false);
  };

  private readonly setVisibility = (isVisible: boolean): void => {
    this.layer.visible = isVisible;
    if (this.active === null) {
      return;
    }
    this.active.imagery.show = isVisible;
  };

  private readonly setOpacity = (opacity: number): void => {
    this.layer.opacity = opacity;
    if (this.active === null) {
      return;
    }
    this.active.imagery.alpha = opacity;
  };
}

interface ActiveBand {
  band: GeoTIFFLayerBand;
  imagery: ImageryLayer;
}

export type LayerTiffImagery = ImageryLayer & {
  controller: LayerTiffController;
};

export interface PickData {
  layer: GeoTIFFLayer;
  coordinates: Cartesian3;
  bands: Array<number | null>;
}

export const isLayerTiffImagery = (
  layer: ImageryLayer,
): layer is LayerTiffImagery =>
  'controller' in layer && layer.controller instanceof LayerTiffController;
