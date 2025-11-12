import {
  LayerInfoPicker,
  LayerPickData,
} from 'src/features/layer/info/pickers/layer-info-picker';
import { lv95ToDegrees, radiansToLv95 } from 'src/projection';
import i18next from 'i18next';
import {
  CallbackProperty,
  Cartesian3,
  Color,
  ColorMaterialProperty,
  ConstantProperty,
  CustomDataSource,
  Entity,
  HeightReference,
  Viewer,
} from 'cesium';
import {
  OBJECT_HIGHLIGHT_COLOR,
  SWISSTOPO_IT_HIGHLIGHT_COLOR,
} from 'src/constants';
import {
  LayerInfo,
  LayerInfoAttribute,
} from 'src/features/layer/info/layer-info.model';
import { WmtsLayerController } from 'src/features/layer/controllers/layer-wmts.controller';
import { Id } from '@swissgeol/ui-core';
import { WmtsLayer } from 'src/features/layer';

export class LayerInfoPickerForWmts implements LayerInfoPicker {
  private readonly highlights: CustomDataSource;

  constructor(
    private readonly controller: WmtsLayerController,
    private readonly viewer: Viewer,
  ) {
    this.highlights = new CustomDataSource(
      `${this.constructor.name}.${controller.layer.id}`,
    );
    this.viewer.dataSources.add(this.highlights).then();
  }

  get layerId(): Id<WmtsLayer> {
    return this.controller.layer.id;
  }

  async pick(pick: LayerPickData): Promise<LayerInfo[]> {
    if (!this.controller.layer.isVisible) {
      return [];
    }
    const geom2056 = radiansToLv95([
      pick.globePosition.cartographic.longitude,
      pick.globePosition.cartographic.latitude,
    ]);
    const tolerance = getTolerance(pick.distance);
    const lang = i18next.language;

    const response = await fetch(
      `https://api3.geo.admin.ch/rest/services/all/MapServer/identify?geometry=${geom2056}&geometryFormat=geojson&geometryType=esriGeometryPoint&mapExtent=0,0,100,100&imageDisplay=100,100,100&lang=${lang}&layers=all:${this.controller.layer.id}&returnGeometry=true&sr=2056&tolerance=${tolerance}`,
    );
    const { results }: { results?: IdentifyResult[] } = await response.json();
    if (results == null || results.length === 0) {
      return [];
    }

    const entities: LayerInfo[] = [];
    for (const result of results) {
      if (result.geometry == null) {
        continue;
      }
      const entity = this.createEntityForGeometry(result.geometry);
      const info = await this.getInfoForResult(result, entity);
      entities.push(info);
    }
    return entities;
  }

  destroy(): void {
    this.viewer.dataSources.remove(this.highlights, true);
  }

  private async getInfoForResult(
    result: IdentifyResult,
    entity: Entity,
  ): Promise<LayerInfoForWmts> {
    const lang = i18next.language;
    const response = await fetch(
      `https://api3.geo.admin.ch/rest/services/api/MapServer/${result.layerBodId}/${result.featureId}/htmlPopup?lang=${lang}`,
    );
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const rows = [...doc.querySelectorAll('.htmlpopup-content table tr')];

    let savedTitle: string | null = null;
    const attributes = rows.reduce((attributes, row) => {
      const [key, val, addition] = row.querySelectorAll('td');
      const keyValue = key.textContent?.trim();

      // Ignore rows that only contain a single value.
      if (val === undefined) {
        if (keyValue) {
          savedTitle = keyValue;
        }
        return attributes;
      }

      // Some rows contain three columns.
      // The first one is a colored rectangle, the second is a buffer, and the third is the layer's name.
      if (
        !keyValue?.length &&
        !val.textContent?.trim().length &&
        addition !== undefined
      ) {
        attributes.push({
          key: savedTitle ?? '',
          value: addition.textContent!.trim(),
        });
        return attributes;
      }

      // The rest are normal key-value rows.
      const value = val.textContent!.trim();
      attributes.push({
        key: keyValue!,
        value,
      });
      return attributes;
    }, [] as LayerInfoAttribute[]);
    return new LayerInfoForWmts(this.viewer, this.highlights, {
      entity,
      title: `layers:layers.${this.controller.layer.id}`,
      layerId: this.controller.layer.id,
      attributes,
    });
  }

  private createEntityForGeometry(geometry: IdentifiedGeometry): Entity {
    switch (geometry.type) {
      case 'Polygon':
        return this.createPolygonEntity(
          (geometry.coordinates as number[][][])[0],
        );
      case 'MultiPolygon':
        return this.createMultiPolygonEntity(
          geometry.coordinates as number[][][][],
        );
      case 'LineString':
        return this.createLineEntity(geometry.coordinates as number[][]);
      case 'MultiLineString':
        return this.createLineEntity((geometry.coordinates as number[][][])[0]);
      case 'Point':
        return this.createPointEntity(geometry.coordinates as number[]);
      case 'MultiPoint':
        return this.createPointEntity((geometry.coordinates as number[][])[0]);
      default:
        throw new Error(`Unsupported geometry type '${geometry.type}'`);
    }
  }

  private createPolygonEntity(nestedCoordinates: number[][]) {
    const coordinates = nestedCoordinates.map((coords) => {
      const degrees = lv95ToDegrees(coords);
      return Cartesian3.fromDegrees(degrees[0], degrees[1]);
    });
    return new Entity({
      polygon: {
        hierarchy: coordinates,
        material: OBJECT_HIGHLIGHT_COLOR.withAlpha(0.7),
      },
    });
  }

  private createMultiPolygonEntity(nestedCoordinates: number[][][][]) {
    const entity = new Entity();
    for (const coordinates of nestedCoordinates) {
      entity.merge(this.createPolygonEntity(coordinates[0]));
    }
    return entity;
  }

  private createLineEntity(nestedCoordinates: number[][]) {
    const coordinates = nestedCoordinates.map((coords) => {
      const degrees = lv95ToDegrees(coords);
      return Cartesian3.fromDegrees(degrees[0], degrees[1]);
    });
    return new Entity({
      polyline: {
        positions: coordinates,
        material: OBJECT_HIGHLIGHT_COLOR,
        clampToGround: true,
        width: 4,
      },
    });
  }

  private createPointEntity(coords: number[]) {
    const degrees = lv95ToDegrees(coords);
    const coordinates = Cartesian3.fromDegrees(degrees[0], degrees[1]);
    const entity = new Entity({
      position: coordinates,
      point: {
        color: new CallbackProperty(
          (t) =>
            entity.point?.outlineWidth?.getValue(t) === 1
              ? SWISSTOPO_IT_HIGHLIGHT_COLOR
              : Color.TRANSPARENT,
          false,
        ),
        pixelSize: 10,
        heightReference: HeightReference.RELATIVE_TO_GROUND,
        outlineColor: Color.BLACK,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    return entity;
  }
}

class LayerInfoForWmts implements LayerInfo {
  public readonly title: string;
  public readonly layerId: Id<WmtsLayer>;
  public readonly attributes: LayerInfoAttribute[];

  private readonly entity: Entity;

  constructor(
    private readonly viewer: Viewer,
    private readonly dataSource: CustomDataSource,
    data: Pick<LayerInfo, 'layerId' | 'title' | 'attributes'> & {
      entity: Entity;
      layerId: Id<WmtsLayer>;
    },
  ) {
    this.entity = data.entity;
    this.title = data.title;
    this.layerId = data.layerId;
    this.attributes = data.attributes;
    this.dataSource.entities.add(this.entity);
  }

  zoomToObject(): void {
    this.viewer.zoomTo(this.entity).then();
  }

  activateHighlight(): void {
    this.viewer.scene.requestRender();

    const { entity } = this;
    if (entity.polygon !== undefined) {
      entity.polygon.material = new ColorMaterialProperty(
        SWISSTOPO_IT_HIGHLIGHT_COLOR,
      );
      return;
    }
    if (entity.polyline !== undefined) {
      entity.polyline.material = new ColorMaterialProperty(
        SWISSTOPO_IT_HIGHLIGHT_COLOR,
      );
      return;
    }
    if (entity.point !== undefined) {
      entity.point.outlineWidth = new ConstantProperty(1);
    }
  }

  deactivateHighlight(): void {
    this.viewer.scene.requestRender();

    const { entity } = this;
    if (entity.polygon !== undefined) {
      entity.polygon.material = new ColorMaterialProperty(
        OBJECT_HIGHLIGHT_COLOR.withAlpha(0.7),
      );
      return;
    }
    if (entity.polyline !== undefined) {
      entity.polyline.material = new ColorMaterialProperty(
        OBJECT_HIGHLIGHT_COLOR,
      );
      return;
    }
    if (entity.point !== undefined) {
      entity.point.outlineWidth = new ConstantProperty(0);
    }
  }

  destroy(): void {
    this.dataSource.entities.remove(this.entity);
  }
}

const getTolerance = (distance: number) => {
  if (distance > 100000) {
    return 300;
  }
  if (distance < 2500) {
    return 20;
  } else {
    return 100;
  }
};

interface IdentifyResult {
  layerBodId: string;
  featureId: string;
  geometry?: IdentifiedGeometry | null;
}

interface IdentifiedGeometry {
  type: string;
  coordinates: number[] | number[][] | number[][][] | number[][][][];
}
