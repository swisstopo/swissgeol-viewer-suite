import {
  LayerInfoPicker,
  LayerPickData,
} from 'src/features/layer/info/pickers/layer-info-picker';
import {
  Cartographic,
  Color,
  Ellipsoid,
  EllipsoidGeodesic,
  Entity,
  HeightReference,
  Math as CesiumMath,
  PolygonHierarchy,
  Viewer,
  ColorMaterialProperty,
} from 'cesium';
import { LayerTiffController, PickData } from 'src/features/layer';
import i18next from 'i18next';
import {
  LayerInfo,
  LayerInfoAttribute,
} from 'src/features/layer/info/layer-info.model';
import { OBJECT_HIGHLIGHT_COLOR } from 'src/constants';

const DEFAULT_COLOR = Color.fromBytes(120, 255, 52, Math.round(0.6 * 255));

export class LayerInfoPickerForTiff implements LayerInfoPicker {
  constructor(
    private readonly viewer: Viewer,
    private readonly controller: LayerTiffController,
  ) {}

  get source(): LayerTiffController {
    return this.controller;
  }

  async pick(pick: LayerPickData): Promise<LayerInfo[]> {
    const data = await this.controller.pick(pick.cartesian);
    if (data === null) {
      return [];
    }
    const { layer } = this.controller;
    const attributes = this.controller.layer.bands.map((band) => {
      return {
        get key(): string {
          return i18next.t(`layers:${layer.id}.bands.${band.name}`);
        },
        get value(): string | number {
          return (
            data.bands[band.index - 1] ?? i18next.t('layers:geoTIFF.noData')
          );
        },
      };
    });
    return [
      new LayerInfoForTiff(this.viewer, {
        entity: this.createHighlight(data),
        source: this.source,
        get title(): string {
          return i18next.t(layer.label);
        },
        attributes,
      }),
    ];
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

    const offset = data.layer.metadata.cellSize / 2;

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
  public readonly entity: Entity;
  public readonly source: LayerTiffController;
  public readonly title: string;
  public readonly attributes: LayerInfoAttribute[];

  constructor(
    private readonly viewer: Viewer,
    data: Pick<LayerInfo, 'entity' | 'source' | 'title' | 'attributes'> & {
      source: LayerTiffController;
    },
  ) {
    this.entity = data.entity;
    this.source = data.source;
    this.title = data.title;
    this.attributes = data.attributes;
    this.viewer.entities.add(this.entity);
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
