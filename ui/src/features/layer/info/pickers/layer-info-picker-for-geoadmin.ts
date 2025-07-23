import {
  LayerInfoPicker,
  LayerPickData,
} from 'src/features/layer/info/pickers/layer-info-picker';
import { LayerTreeNode } from 'src/layertree';
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

export class LayerInfoPickerForGeoadmin implements LayerInfoPicker {
  private readonly highlights: CustomDataSource;

  constructor(
    readonly layer: LayerTreeNode,
    private readonly viewer: Viewer,
  ) {
    this.highlights = new CustomDataSource(
      `LayerInfoPickerForGeoadmin.${layer.layer}`,
    );
    this.viewer.dataSources.add(this.highlights);
  }

  async pick(pick: LayerPickData): Promise<LayerInfo[]> {
    const geom2056 = radiansToLv95([
      pick.cartographic.longitude,
      pick.cartographic.latitude,
    ]);
    const tolerance = getTolerance(pick.distance);
    const lang = i18next.language;

    const response = await fetch(
      `https://api3.geo.admin.ch/rest/services/all/MapServer/identify?geometry=${geom2056}&geometryFormat=geojson&geometryType=esriGeometryPoint&mapExtent=0,0,100,100&imageDisplay=100,100,100&lang=${lang}&layers=all:${this.layer.layer}&returnGeometry=true&sr=2056&tolerance=${tolerance}`,
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
  ): Promise<LayerInfoForGeoadmin> {
    const lang = i18next.language;
    const response = await fetch(
      `https://api3.geo.admin.ch/rest/services/api/MapServer/${result.layerBodId}/${result.featureId}/htmlPopup?lang=${lang}`,
    );
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const title = doc!
      .querySelector('.htmlpopup-header span')!
      .textContent!.trim();

    const rows = [...doc.querySelectorAll('.htmlpopup-content table tr')];
    const attributes = rows.map((row) => {
      const [key, val] = row.querySelectorAll('td');
      const value = val.textContent!.trim();
      return {
        key: key.textContent!.trim(),
        value,
      } satisfies LayerInfoAttribute;
    });
    return new LayerInfoForGeoadmin(this.highlights, {
      entity,
      layer: this.layer,
      title: title,
      attributes,
    });
  }

  private createEntityForGeometry(geometry: IdentifiedGeometry): Entity {
    console.log(geometry.type);
    switch (geometry.type) {
      case 'MultiPolygon':
        return this.createMultiPolygonEntity(
          geometry.coordinates as number[][][][],
        );
      case 'Polygon':
        return this.createPolygonEntity(
          (geometry.coordinates as number[][][])[0],
        );
      case 'MultiLineString':
        return this.createLineEntity(geometry.coordinates as number[][][]);
      case 'MultiPoint':
        return this.createPointEntity((geometry.coordinates as number[][])[0]);
      case 'Point': {
        return this.createPointEntity(geometry.coordinates as number[]);
      }
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

  private createLineEntity([nestedCoordinates]: number[][][]) {
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

class LayerInfoForGeoadmin implements LayerInfo {
  public readonly entity: Entity;
  public readonly layer: LayerTreeNode;
  public readonly title: string;
  public readonly attributes: LayerInfoAttribute[];

  constructor(
    private readonly dataSource: CustomDataSource,
    data: Pick<LayerInfo, 'entity' | 'layer' | 'title' | 'attributes'>,
  ) {
    this.entity = data.entity;
    this.layer = data.layer;
    this.title = data.title;
    this.attributes = data.attributes;
    this.dataSource.entities.add(this.entity);
  }

  activateHighlight(): void {
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
