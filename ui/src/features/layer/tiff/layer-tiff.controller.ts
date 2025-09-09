import {
  Cartesian3,
  Ellipsoid,
  ImageryLayer,
  Math as CesiumMath,
  Resource,
  UrlTemplateImageryProvider,
  Viewer,
  WebMercatorTilingScheme,
  Rectangle,
} from 'cesium';
import { GeoTIFFLayer, GeoTIFFLayerBand, LayerConfig } from 'src/layertree';
import { SWITZERLAND_RECTANGLE, TITILER_BY_PAGE_HOST } from 'src/constants';
import proj4 from 'proj4';

export class LayerTiffController {
  private active!: ActiveBand;

  private metadata!: TiffMetadata;

  constructor(
    readonly layer: LayerConfig & GeoTIFFLayer,
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

    this.fetchMetadata().then((info) => (this.metadata = info));
  }

  get activeImagery(): ImageryLayer {
    return this.active.imagery;
  }

  get activeBand(): GeoTIFFLayerBand {
    return this.active.band;
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
      this.viewer.scene.imageryLayers.remove(this.active.imagery, false);
    }

    const imagery = this.makeImagery(band);
    const oldImagery = this.active;
    this.active = { imagery, band };
    if (oldImageryIndex !== -1) {
      this.addToViewer(oldImageryIndex);
    }
    this.viewer.scene.requestRender();
    if (oldImagery != null) {
      setTimeout(() => {
        oldImagery.imagery.destroy();
      });
    }
  }

  async pick(cartesian: Cartesian3): Promise<PickData | null> {
    if (!this.layer.visible) {
      return null;
    }

    const coords = Ellipsoid.WGS84.cartesianToCartographic(cartesian);
    const longitude = CesiumMath.toDegrees(coords.longitude);
    const latitude = CesiumMath.toDegrees(coords.latitude);

    interface Json {
      coordinates: [number, number];
      values: Array<number | null>;
      band_names: string[];
    }

    const url = `${TITILER_BY_PAGE_HOST[window.location.host]}/cog/point/${longitude},${latitude}?url=${this.layer.url}`;
    const json: Json = await Resource.fetchJson({ url });
    try {
      const activeValue = json.values[this.active.band.index - 1];
      if (activeValue === null) {
        return null;
      }
      const [cellLongitude, cellLatitude] = this.computeCellCenter(
        longitude,
        latitude,
      );
      return {
        layer: this.layer,
        coordinates: Cartesian3.fromDegrees(
          cellLongitude,
          cellLatitude,
          coords.height,
        ),
        bands: json.values,
      };
    } catch (e) {
      console.error(`failed to pick geoTIFF ${this.layer.id}`, e);
      return null;
    }
  }

  zoomIntoView(): void {
    const bounds = this.metadata.bounds;

    const cornersSrc = [
      [bounds[0], bounds[1]], // SW
      [bounds[0], bounds[3]], // NW
      [bounds[2], bounds[1]], // SE
      [bounds[2], bounds[3]], // NE
    ];

    const cornersWgs84 = cornersSrc.map(([x, y]) =>
      proj4(this.metadata.crs, 'EPSG:4326', [x, y]),
    );

    const lons = cornersWgs84.map((c) => c[0]);
    const lats = cornersWgs84.map((c) => c[1]);
    const west = Math.min(...lons);
    const east = Math.max(...lons);
    const south = Math.min(...lats);
    const north = Math.max(...lats);

    const rect = Rectangle.fromDegrees(west, south, east, north);
    this.viewer.camera.flyTo({ destination: rect });
  }

  private makeImagery(band: GeoTIFFLayerBand): LayerTiffImagery {
    const noDataParam =
      band.display?.noData === undefined ? '' : '&nodata={nodata}';
    const rescaleParam = band.display?.isDiscrete ? '' : '&rescale={min},{max}';
    const provider = new UrlTemplateImageryProvider({
      url: `${TITILER_BY_PAGE_HOST[window.location.host]}/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url={url}&bidx={bidx}&colormap_name={colormap}${rescaleParam}${noDataParam}`,
      customTags: {
        url: () => this.layer.url,
        bidx: () => band.index,
        colormap: () => band.display!.colorMap?.name,
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

  private async fetchMetadata(): Promise<TiffMetadata> {
    interface Json {
      bounds: [number, number, number, number];
      crs: `http://www.opengis.net/def/crs/EPSG/0/${number}`;
      width: number;
      height: number;
    }

    const url = `${TITILER_BY_PAGE_HOST[window.location.host]}/cog/info?url=${this.layer.url}`;
    const json: Json = await Resource.fetchJson({ url });

    const [minX, minY, maxX, maxY] = json.bounds;
    const widthInCrs = maxX - minX;
    const heightInCrs = maxY - minY;

    const cellWidth = widthInCrs / json.width;
    const cellHeight = heightInCrs / json.height;

    return {
      bounds: json.bounds,
      crs: `EPSG:${json.crs.slice(json.crs.lastIndexOf('/') + 1)}`,
      dimension: [json.width, json.height],
      cellDimension: [cellWidth, cellHeight],
    };
  }

  /**
   * Given a 2d coordinate, this method calculates in which of the TIFF's cells that coordinate falls.
   *
   * @param lon The coordinate's longitude.
   * @param lat The coordinate's latitude.
   * @return The center longitude/latitude of the cell that contains the given coordinates.
   *
   * @private
   */
  private computeCellCenter(lon: number, lat: number): [number, number] {
    const wgs84 = 'EPSG:4326';

    const [x, y] = proj4(wgs84, this.metadata.crs, [lon, lat]);

    const [originX, _y, _x, originY] = this.metadata.bounds;
    const [cellWidth, cellHeight] = this.metadata.cellDimension;

    const px = Math.floor((x - originX) / cellWidth);
    const py = Math.floor((y - originY) / cellHeight);

    const centerPx = px;
    const centerPy = py;

    const centerX = cellWidth * centerPx + originX + cellWidth / 2;
    const centerY = cellHeight * centerPy + originY + cellHeight / 2;

    const [centerLon, centerLat] = proj4(this.metadata.crs, wgs84, [
      centerX,
      centerY,
    ]);

    return [centerLon, centerLat];
  }
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

interface TiffMetadata {
  /**
   * The TIFF's coordinate system (e.g. "EPSG:4326").
   */
  crs: string;

  /**
   * The TIFF's bounding rectangle in the format `[minX, minY, maxX, maxY]`.
   * The units correspond to the TIFF's {@link crs coordinate system}.
   */
  bounds: [number, number, number, number];

  /**
   * The amount of cells (i.e. pixels) the TIFF contains on its x- and y-axis, respectively.
   */
  dimension: [number, number];

  /**
   * The size of each of the TIFF's cells (i.e. pixels) inside the TIFF's {@link crs coordinate system}.
   */
  cellDimension: [number, number];
}

export const isLayerTiffImagery = (
  layer: ImageryLayer,
): layer is LayerTiffImagery =>
  'controller' in layer && layer.controller instanceof LayerTiffController;
