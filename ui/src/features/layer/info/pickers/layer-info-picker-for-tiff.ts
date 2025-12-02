import {
  LayerInfoPicker,
  LayerPickData,
} from 'src/features/layer/info/pickers/layer-info-picker';
import {
  Cartesian3,
  Cartographic,
  Color,
  ColorMaterialProperty,
  Ellipsoid,
  EllipsoidGeodesic,
  Entity,
  HeightReference,
  JulianDate,
  Math as CesiumMath,
  PolygonHierarchy,
  Resource,
  Viewer,
} from 'cesium';
import {
  getLayerAttributeName,
  getTranslationKeyForLayerAttributeName,
  mapLayerSourceToResource,
  TiffLayer,
} from 'src/features/layer';
import i18next from 'i18next';
import {
  LayerInfo,
  LayerInfoAttribute,
} from 'src/features/layer/info/layer-info.model';
import { OBJECT_HIGHLIGHT_COLOR, TITILER_BY_PAGE_HOST } from 'src/constants';
import { TiffLayerController } from 'src/features/layer/controllers/layer-tiff.controller';
import { Id } from 'src/models/id.model';
import proj4 from 'proj4';

const DEFAULT_COLOR = Color.fromBytes(120, 255, 52, Math.round(0.6 * 255));

export class LayerInfoPickerForTiff implements LayerInfoPicker {
  private metadata!: TiffMetadata;

  constructor(
    private readonly controller: TiffLayerController,
    private readonly viewer: Viewer,
  ) {}

  get layerId(): Id<TiffLayer> {
    return this.controller.layer.id;
  }

  async pick(pick: LayerPickData): Promise<LayerInfo[]> {
    if (!this.controller.layer.isVisible) {
      return [];
    }
    this.metadata ??= await this.fetchMetadata();
    const data = await this.pickViaService(pick.globePosition.cartographic);
    if (data === null) {
      return [];
    }
    const { layer } = this.controller;
    const attributes = this.controller.layer.bands.map((band) => {
      return {
        key: getTranslationKeyForLayerAttributeName(layer, band.name),
        get value(): string | number {
          return (
            data.bands[band.index - 1] ?? i18next.t('layers:values.no_data')
          );
        },
      };
    });
    return [
      new LayerInfoForTiff(this.viewer, {
        entity: this.createHighlight(data),
        layerId: this.layerId,
        title: `layers:layers.${this.controller.layer.id}`,
        attributes,
      }),
    ];
  }

  private async pickViaService(coords: Cartographic): Promise<PickData | null> {
    const longitude = CesiumMath.toDegrees(coords.longitude);
    const latitude = CesiumMath.toDegrees(coords.latitude);

    interface Json {
      coordinates: [number, number];
      values: Array<number | null>;
      band_names: string[];
    }

    const { layer } = this.controller;
    const resource = await mapLayerSourceToResource(layer.source);
    const url = `${TITILER_BY_PAGE_HOST[globalThis.location.host]}/cog/point/${longitude},${latitude}?url=${resource.url}`;
    const json: Json = await Resource.fetchJson({ url });
    try {
      const activeBandIndex = layer.bands[layer.bandIndex].index;
      const activeValue = json.values[activeBandIndex - 1];
      if (activeValue === null) {
        return null;
      }
      const [cellLongitude, cellLatitude] = this.computeCellCenter(
        longitude,
        latitude,
      );
      return {
        coordinates: Cartesian3.fromDegrees(
          cellLongitude,
          cellLatitude,
          coords.height,
        ),
        bands: json.values,
      };
    } catch (e) {
      console.error(`failed to pick TIFF ${this.layerId}`, e);
      return null;
    }
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

  private async fetchMetadata(): Promise<TiffMetadata> {
    interface Json {
      bounds: [number, number, number, number];
      crs: `http://www.opengis.net/def/crs/EPSG/0/${number}`;
      width: number;
      height: number;
    }

    const resource = await mapLayerSourceToResource(
      this.controller.layer.source,
    );

    const url = `${TITILER_BY_PAGE_HOST[globalThis.location.host]}/cog/info?url=${resource.url}`;
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

  private createHighlight(data: PickData): Entity {
    const centerCarto = Cartographic.fromCartesian(data.coordinates);
    const geodesic = new EllipsoidGeodesic();

    function offsetPosition(
      carto: Cartographic,
      dNorth: number,
      dEast: number,
    ) {
      const delta = CesiumMath.toRadians(0.00001);

      geodesic.setEndPoints(
        carto,
        new Cartographic(carto.longitude, carto.latitude + delta),
      );
      const meterPerLat = geodesic.surfaceDistance / delta;

      geodesic.setEndPoints(
        carto,
        new Cartographic(carto.longitude + delta, carto.latitude),
      );
      const meterPerLon = geodesic.surfaceDistance / delta;

      const dLat = dNorth / meterPerLat;
      const dLon = dEast / meterPerLon;

      return Ellipsoid.WGS84.cartographicToCartesian(
        new Cartographic(carto.longitude + dLon, carto.latitude + dLat),
      );
    }

    const offset = this.controller.layer.cellSize / 2;

    // Calculate corners of a 10x10 rectangle, adjusted for the current projection.
    const positions = [
      offsetPosition(centerCarto, -offset, -offset),
      offsetPosition(centerCarto, -offset, offset),
      offsetPosition(centerCarto, offset, offset),
      offsetPosition(centerCarto, offset, -offset),
    ];

    return new Entity({
      position: data.coordinates,
      polygon: {
        hierarchy: new PolygonHierarchy(positions),
        material: DEFAULT_COLOR,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        perPositionHeight: false,
      },
    });
  }

  destroy(): void {}
}

class LayerInfoForTiff implements LayerInfo {
  public readonly layerId: Id<TiffLayer>;
  public readonly title: string;
  public readonly attributes: LayerInfoAttribute[];
  private readonly entity: Entity;

  constructor(
    private readonly viewer: Viewer,
    data: Pick<LayerInfo, 'layerId' | 'title' | 'attributes'> & {
      entity: Entity;
      layerId: Id<TiffLayer>;
    },
  ) {
    this.entity = data.entity;
    this.layerId = data.layerId;
    this.title = data.title;
    this.attributes = data.attributes;
    this.viewer.entities.add(this.entity);
  }

  zoomToObject(): void {
    const coords = this.entity.position!.getValue(JulianDate.now())!;
    const position = Cartographic.fromCartesian(coords);

    this.viewer.camera.setView({
      destination: Cartesian3.fromRadians(
        position.longitude,
        position.latitude,
        position.height + 1000,
      ),
    });
  }

  activateHighlight(): void {
    this.entity.polygon!.material = new ColorMaterialProperty(
      OBJECT_HIGHLIGHT_COLOR,
    );
  }

  deactivateHighlight(): void {
    this.entity.polygon!.material = new ColorMaterialProperty(DEFAULT_COLOR);
  }

  destroy(): void {
    this.viewer.entities.remove(this.entity);
  }
}

interface PickData {
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
