import {
  LayerInfoPicker,
  LayerPickData,
} from 'src/features/layer/info/pickers/layer-info-picker';
import { lv95ToDegrees, radiansToLv95 } from 'src/projection';
import i18next from 'i18next';
import {
  Cartesian3,
  Color,
  CustomDataSource,
  Entity,
  HeightReference,
  PolygonHierarchy,
  Viewer,
} from 'cesium';
import { SWISSTOPO_IT_HIGHLIGHT_COLOR } from 'src/constants';
import {
  LayerInfo,
  LayerInfoAttribute,
} from 'src/features/layer/info/layer-info.model';
import { WmtsLayerController } from 'src/features/layer/controllers/layer-wmts.controller';
import { WmtsLayer } from 'src/features/layer';
import { Id } from 'src/models/id.model';
import type { Position } from 'geojson';
import {
  IdentifiedGeometry,
  IdentifyResult,
  LayerInfoPickerForWmtsService,
  ServiceFeatureInfoFeature,
} from 'src/features/layer/info/pickers/layer-info-picker-for-wmts.service';

import {
  distanceToWmtsGeometry,
  isDirectWmtsMatch,
} from './layer-info-wmts-geometry';

export class LayerInfoPickerForWmts implements LayerInfoPicker {
  private readonly highlights: CustomDataSource;
  private readonly service: LayerInfoPickerForWmtsService;

  constructor(
    private readonly controller: WmtsLayerController,
    private readonly viewer: Viewer,
  ) {
    this.highlights = new CustomDataSource(
      `${this.constructor.name}.${controller.layer.id}`,
    );
    this.service = new LayerInfoPickerForWmtsService(controller.layer);
    this.viewer.dataSources.add(this.highlights).then();
  }

  get layerId(): Id<WmtsLayer> {
    return this.controller.layer.id;
  }

  async pick(pick: LayerPickData): Promise<LayerInfo[]> {
    if (!this.controller.layer.isVisible) {
      return [];
    }
    // When the camera is underground, the map/basemap surface generally
    // isn't what's actually under the cursor (e.g. an underground slice), and
    // the picked position (see `PickService.pickWithMath`'s ellipsoid
    // fallback for rays that miss the terrain) is a rough approximation, not
    // a real point on the ground. Querying geo.admin's identify service for
    // it would be both meaningless and slow (or fail outright), so skip it.
    if (this.viewer.scene.cameraUnderground) {
      return [];
    }

    // Flow:
    // 1) Try geo.admin identify/htmlPopup when supported.
    // 2) If no results, fallback to external WMS GetFeatureInfo.
    // 3) Convert returned geometry + attributes to LayerInfo objects.
    const geom2056 = radiansToLv95([
      pick.globePosition.cartographic.longitude,
      pick.globePosition.cartographic.latitude,
    ]) as [number, number];
    const tolerance = getTolerance(pick.distance);
    const lang = i18next.language;

    const results = this.service.shouldUseGeoAdminIdentify()
      ? await this.service.fetchIdentifyResults(geom2056, tolerance, lang)
      : null;
    if (results != null && results.length > 0) {
      return Promise.all(
        getWmtsHits(results, geom2056).map((hit) => this.getInfoForResult(hit)),
      );
    }

    // For external (non-geo.admin) layers, or when identify returns no results,
    // fall back to a standard WMS GetFeatureInfo request against the layer's serviceUrl.
    const serviceFeatures = await this.service.fetchServiceFeatureInfo(
      geom2056,
      lang,
    );
    if (serviceFeatures == null || serviceFeatures.length === 0) {
      return [];
    }

    // A geometry-less GetFeatureInfo response refers to the requested pixel.
    return getWmtsHits(serviceFeatures, geom2056, {
      type: 'Point',
      coordinates: geom2056,
    }).map(
      ({ feature, geometry, distance, label }) =>
        new LayerInfoForWmts(this.viewer, this.highlights, {
          createHighlight: () => this.createEntitiesForGeometry(geometry),
          title: `layers:layers.${this.controller.layer.id}`,
          layerId: this.controller.layer.id,
          featureLabel: label,
          distance,
          match: isDirectWmtsMatch(distance) ? 'direct' : 'nearby',
          attributes: this.service.mapFeaturePropertiesToAttributes(
            feature.properties,
          ),
        }),
    );
  }

  destroy(): void {
    this.viewer.dataSources.remove(this.highlights, true);
  }

  private async getInfoForResult({
    feature: result,
    geometry,
    distance,
    label,
  }: WmtsHit<IdentifyResult>): Promise<LayerInfoForWmts> {
    const lang = i18next.language;
    const html = await this.service.fetchHtmlPopup(result, lang);
    const attributes = this.service.extractPopupAttributes(html);
    return new LayerInfoForWmts(this.viewer, this.highlights, {
      createHighlight: () => this.createEntitiesForGeometry(geometry),
      title: `layers:layers.${this.controller.layer.id}`,
      layerId: this.controller.layer.id,
      featureLabel: label,
      distance,
      match: isDirectWmtsMatch(distance) ? 'direct' : 'nearby',
      attributes,
      identifyResult: result,
      service: this.service,
    });
  }

  private createEntitiesForGeometry(geometry: IdentifiedGeometry): Entity[] {
    switch (geometry.type) {
      case 'Polygon':
        return [this.createPolygonEntity(geometry.coordinates)];
      case 'MultiPolygon':
        return geometry.coordinates.map((polygon) =>
          this.createPolygonEntity(polygon),
        );
      case 'LineString':
        return [this.createLineEntity(geometry.coordinates)];
      case 'MultiLineString':
        return geometry.coordinates.map((line) => this.createLineEntity(line));
      case 'Point':
        return [this.createPointEntity(geometry.coordinates)];
      case 'MultiPoint':
        return geometry.coordinates.map((point) =>
          this.createPointEntity(point),
        );
      default:
        return [];
    }
  }

  private createPolygonEntity([outer, ...holes]: Position[][]): Entity {
    return new Entity({
      polygon: {
        hierarchy: new PolygonHierarchy(
          outer.map(toCartesian),
          holes.map((hole) => new PolygonHierarchy(hole.map(toCartesian))),
        ),
        material: SWISSTOPO_IT_HIGHLIGHT_COLOR.withAlpha(0.7),
      },
    });
  }

  private createLineEntity(line: Position[]): Entity {
    return new Entity({
      polyline: {
        positions: line.map(toCartesian),
        material: SWISSTOPO_IT_HIGHLIGHT_COLOR,
        clampToGround: true,
        width: 4,
      },
    });
  }

  private createPointEntity(point: Position): Entity {
    return new Entity({
      position: toCartesian(point),
      point: {
        color: SWISSTOPO_IT_HIGHLIGHT_COLOR,
        pixelSize: 10,
        heightReference: HeightReference.RELATIVE_TO_GROUND,
        outlineColor: Color.BLACK,
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
  }
}

const toCartesian = (position: Position): Cartesian3 => {
  const [longitude, latitude] = lv95ToDegrees(position);
  return Cartesian3.fromDegrees(longitude, latitude);
};

type WmtsFeature = IdentifyResult | ServiceFeatureInfoFeature;

interface WmtsHit<T> {
  feature: T;
  geometry: IdentifiedGeometry;
  distance: number;
  label?: string;
}

const getWmtsHits = <T extends WmtsFeature>(
  features: T[],
  clickedPosition: Position,
  fallbackGeometry?: IdentifiedGeometry,
): WmtsHit<T>[] => {
  const labelCounts = new Map<string, number>();
  const hits = features.flatMap((feature) => {
    const geometry = feature.geometry ?? fallbackGeometry;
    if (geometry == null) {
      return [];
    }

    const distance = distanceToWmtsGeometry(clickedPosition, geometry);
    if (!Number.isFinite(distance)) {
      return [];
    }

    const id = 'featureId' in feature ? feature.featureId : feature.id;
    const name = getFeatureName(feature.properties);
    if (name !== undefined) {
      labelCounts.set(name, (labelCounts.get(name) ?? 0) + 1);
    }
    return [{ feature, geometry, distance, name, id }];
  });

  return hits
    .sort((a, b) => a.distance - b.distance)
    .map(({ feature, geometry, distance, name, id }) => ({
      feature,
      geometry,
      distance,
      label:
        name === undefined || (labelCounts.get(name) ?? 0) > 1
          ? formatFeatureLabel(name, id)
          : name,
    }));
};

const getFeatureName = (
  properties: Record<string, unknown> | null | undefined,
): string | undefined => {
  for (const key of ['label', 'name', 'title', 'bezeichnung']) {
    const value = properties?.[key];
    if (typeof value === 'string') {
      const label = value.trim();
      if (label && label !== '-') {
        return label;
      }
    }
  }
  return undefined;
};

const formatFeatureLabel = (
  name: string | undefined,
  id: string | number | undefined,
): string | undefined => {
  if (id == null) {
    return name;
  }
  return name === undefined ? '#' + id : name + ' (#' + id + ')';
};

class LayerInfoForWmts implements LayerInfo {
  public readonly title: string;
  public readonly layerId: Id<WmtsLayer>;
  public readonly featureLabel?: string;
  public readonly distance: number;
  public readonly match: 'direct' | 'nearby';
  public attributes: LayerInfoAttribute[];

  private readonly createHighlight: () => Entity[];
  private entities?: Entity[];
  private isSelected = false;
  private readonly identifyResult: IdentifyResult | null;
  private readonly service: LayerInfoPickerForWmtsService | null;

  constructor(
    private readonly viewer: Viewer,
    private readonly dataSource: CustomDataSource,
    data: Pick<LayerInfo, 'layerId' | 'title' | 'attributes'> & {
      createHighlight: () => Entity[];
      layerId: Id<WmtsLayer>;
      featureLabel?: string;
      distance: number;
      match: 'direct' | 'nearby';
      identifyResult?: IdentifyResult;
      service?: LayerInfoPickerForWmtsService;
    },
  ) {
    this.createHighlight = data.createHighlight;
    this.featureLabel = data.featureLabel;
    this.distance = data.distance;
    this.match = data.match;
    this.title = data.title;
    this.layerId = data.layerId;
    this.attributes = data.attributes;
    this.identifyResult = data.identifyResult ?? null;
    this.service = data.service ?? null;
  }

  async refreshForLanguage(lang: string): Promise<void> {
    if (this.identifyResult == null || this.service == null) {
      return;
    }
    try {
      const html = await this.service.fetchHtmlPopup(this.identifyResult, lang);
      this.attributes = this.service.extractPopupAttributes(html);
    } catch (error) {
      console.error(
        `Failed to refresh attributes for layer ${this.layerId} in language ${lang}:`,
        error,
      );
    }
  }

  zoomToObject(): void {
    const entities = (this.entities ??= this.createHighlight());
    if (entities.length > 0) {
      this.viewer.zoomTo(entities).then();
    }
  }

  select(): void {
    if (this.isSelected) {
      return;
    }
    const entities = (this.entities ??= this.createHighlight());
    for (const entity of entities) {
      this.dataSource.entities.add(entity);
    }
    this.isSelected = true;
    this.viewer.scene.requestRender();
  }

  deselect(): void {
    if (!this.isSelected) {
      return;
    }
    for (const entity of this.entities ?? []) {
      this.dataSource.entities.remove(entity);
    }
    this.isSelected = false;
    this.viewer.scene.requestRender();
  }

  destroy(): void {
    this.deselect();
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
