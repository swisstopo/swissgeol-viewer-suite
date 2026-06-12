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
import { WmtsLayer, WmtsLayerSource } from 'src/features/layer';
import { Id } from 'src/models/id.model';

const DEFAULT_GEO_ADMIN_API_URL = 'https://api3.geo.admin.ch';

// Dimensions used for WMS GetFeatureInfo requests.
// The click point is placed at the center pixel of the request image.
const FEATURE_INFO_WIDTH = 101;
const FEATURE_INFO_HEIGHT = 101;
// Half-size of the bounding box (in CRS units) around the click point.
const FEATURE_INFO_BBOX_DELTA = 5;

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
    ]) as [number, number];
    const tolerance = getTolerance(pick.distance);
    const lang = i18next.language;

    const results = this.shouldUseGeoAdminIdentify()
      ? await this.fetchIdentifyResults(geom2056, tolerance, lang)
      : null;
    if (results != null && results.length > 0) {
      const entities: Array<Promise<LayerInfo>> = [];
      for (const result of results) {
        if (result.geometry == null) {
          continue;
        }
        const entity = this.createEntityForGeometry(result.geometry);
        entities.push(this.getInfoForResult(result, entity));
      }
      return Promise.all(entities);
    }

    // For external (non-geo.admin) layers, or when identify returns no results,
    // fall back to a standard WMS GetFeatureInfo request against the layer's serviceUrl.
    const serviceFeatures = await this.fetchServiceFeatureInfo(geom2056, lang);
    if (serviceFeatures == null || serviceFeatures.length === 0) {
      return [];
    }

    return serviceFeatures.map((feature) => {
      const entity =
        feature.geometry == null
          ? this.createPointEntity(geom2056)
          : this.createEntityForGeometry(feature.geometry);
      return new LayerInfoForWmts(this.viewer, this.highlights, {
        entity,
        title: `layers:layers.${this.controller.layer.id}`,
        layerId: this.controller.layer.id,
        attributes: this.mapFeaturePropertiesToAttributes(feature.properties),
      });
    });
  }

  destroy(): void {
    this.viewer.dataSources.remove(this.highlights, true);
  }

  private async getInfoForResult(
    result: IdentifyResult,
    entity: Entity,
  ): Promise<LayerInfoForWmts> {
    const extractTextOrLink = (
      element: HTMLElement,
    ): LayerInfoAttribute['value'] => {
      if (
        element.childElementCount === 1 &&
        element.children[0].tagName === 'A'
      ) {
        const anchor = element.children[0] as HTMLAnchorElement;
        return { url: anchor.href, name: anchor.text };
      }
      return element.textContent!.trim();
    };

    const lang = i18next.language;
    const html = await this.fetchHtmlPopup(result, lang);
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
          value: extractTextOrLink(addition),
        });
        return attributes;
      }

      // The rest are normal key-value rows.
      const value = extractTextOrLink(val);
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

  private buildIdentifyUrl(
    geom2056: [number, number],
    tolerance: number,
    lang: string,
    baseUrl: string,
  ): string {
    const url = new URL('rest/services/all/MapServer/identify', baseUrl);
    url.searchParams.set('geometry', geom2056.join(','));
    url.searchParams.set('geometryFormat', 'geojson');
    url.searchParams.set('geometryType', 'esriGeometryPoint');
    url.searchParams.set('mapExtent', '0,0,100,100');
    url.searchParams.set('imageDisplay', '100,100,100');
    url.searchParams.set('lang', lang);
    url.searchParams.set('layers', `all:${this.controller.layer.id}`);
    url.searchParams.set('returnGeometry', 'true');
    url.searchParams.set('sr', '2056');
    url.searchParams.set('tolerance', String(tolerance));
    return url.toString();
  }

  private buildHtmlPopupUrl(
    result: IdentifyResult,
    lang: string,
    baseUrl: string,
  ): string {
    const url = new URL(
      `rest/services/api/MapServer/${result.layerBodId}/${result.featureId}/htmlPopup`,
      baseUrl,
    );
    url.searchParams.set('lang', lang);
    return url.toString();
  }

  private async fetchIdentifyResults(
    geom2056: [number, number],
    tolerance: number,
    lang: string,
  ): Promise<IdentifyResult[] | null> {
    for (const baseUrl of this.buildRestApiBaseUrls()) {
      const identifyUrl = this.buildIdentifyUrl(
        geom2056,
        tolerance,
        lang,
        baseUrl,
      );
      try {
        const response = await fetch(identifyUrl);
        if (!response.ok) {
          continue;
        }
        const body = await response.text();
        const parsed = JSON.parse(body) as { results?: IdentifyResult[] };
        if (parsed.results !== undefined) {
          return parsed.results;
        }
      } catch (e) {
        console.warn(
          `[LayerInfoPickerForWmts] identify failed for ${baseUrl}:`,
          e,
        );
      }
    }

    return null;
  }

  private async fetchHtmlPopup(
    result: IdentifyResult,
    lang: string,
  ): Promise<string> {
    for (const baseUrl of this.buildRestApiBaseUrls()) {
      const popupUrl = this.buildHtmlPopupUrl(result, lang, baseUrl);
      try {
        const response = await fetch(popupUrl);
        if (!response.ok) {
          continue;
        }
        return await response.text();
      } catch (e) {
        console.warn(
          `[LayerInfoPickerForWmts] htmlPopup failed for ${baseUrl}:`,
          e,
        );
      }
    }

    return '';
  }

  private async fetchServiceFeatureInfo(
    geom2056: [number, number],
    lang: string,
  ): Promise<ServiceFeatureInfoFeature[] | null> {
    const infoUrl = this.buildServiceFeatureInfoUrl(geom2056, lang);
    if (infoUrl === null) {
      return null;
    }

    try {
      const response = await fetch(infoUrl);
      if (!response.ok) {
        return null;
      }

      const body = await response.text();
      const parsed = JSON.parse(body) as Partial<ServiceFeatureInfoResponse>;
      if (Array.isArray(parsed.features)) {
        return parsed.features;
      }
    } catch (e) {
      console.warn(
        `[LayerInfoPickerForWmts] GetFeatureInfo failed for ${infoUrl}:`,
        e,
      );
      return null;
    }

    return null;
  }

  private buildServiceFeatureInfoUrl(
    geom2056: [number, number],
    lang: string,
  ): string | null {
    const { serviceUrl } = this.controller.layer;
    if (serviceUrl === null) {
      return null;
    }

    let base: URL;
    try {
      base = new URL(serviceUrl);
    } catch {
      return null;
    }

    base.pathname = base.pathname
      .replace(/\/gwc\/service\/wmts\/?$/i, '/wms')
      .replace(/\/service\/wmts\/?$/i, '/wms')
      .replace(/\/wmts\/?$/i, '/wms');
    base.search = '';
    base.hash = '';

    const [x, y] = geom2056;

    base.searchParams.set('SERVICE', 'WMS');
    base.searchParams.set('VERSION', '1.3.0');
    base.searchParams.set('REQUEST', 'GetFeatureInfo');
    base.searchParams.set('LAYERS', String(this.controller.layer.id));
    base.searchParams.set('QUERY_LAYERS', String(this.controller.layer.id));
    base.searchParams.set('STYLES', '');
    base.searchParams.set('CRS', 'EPSG:2056');
    base.searchParams.set(
      'BBOX',
      `${x - FEATURE_INFO_BBOX_DELTA},${y - FEATURE_INFO_BBOX_DELTA},${x + FEATURE_INFO_BBOX_DELTA},${y + FEATURE_INFO_BBOX_DELTA}`,
    );
    base.searchParams.set('WIDTH', String(FEATURE_INFO_WIDTH));
    base.searchParams.set('HEIGHT', String(FEATURE_INFO_HEIGHT));
    base.searchParams.set('I', String(Math.floor(FEATURE_INFO_WIDTH / 2)));
    base.searchParams.set('J', String(Math.floor(FEATURE_INFO_HEIGHT / 2)));
    base.searchParams.set('INFO_FORMAT', 'application/json');
    base.searchParams.set('FEATURE_COUNT', '10');
    base.searchParams.set('LANG', lang);

    return base.toString();
  }

  private mapFeaturePropertiesToAttributes(
    properties: Record<string, unknown> | null | undefined,
  ): LayerInfoAttribute[] {
    if (properties == null) {
      return [];
    }

    return Object.entries(properties).map(([key, rawValue]) => ({
      key,
      value: this.normalizeAttributeValue(rawValue),
    }));
  }

  private normalizeAttributeValue(value: unknown): LayerInfoAttribute['value'] {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (value === null || value === undefined) {
      return '';
    }

    try {
      return JSON.stringify(value);
    } catch {
      // JSON.stringify can throw on circular references.
      return String(value);
    }
  }

  private buildRestApiBaseUrls(): string[] {
    const primary = this.deriveRestApiBaseUrl();
    const normalizedDefault = `${DEFAULT_GEO_ADMIN_API_URL}/`;
    if (
      primary === normalizedDefault ||
      primary === DEFAULT_GEO_ADMIN_API_URL
    ) {
      return [normalizedDefault];
    }
    // Try the layer's own service base first, then fall back to the default geo.admin API.
    return [primary, normalizedDefault];
  }

  private shouldUseGeoAdminIdentify(): boolean {
    const { serviceUrl } = this.controller.layer;
    if (serviceUrl === null) {
      return true;
    }

    try {
      const hostname = new URL(serviceUrl).hostname.toLowerCase();
      return hostname.endsWith('geo.admin.ch') || hostname.startsWith('api3.');
    } catch {
      return true;
    }
  }

  /**
   * Derives the REST API base URL from the layer's serviceUrl.
   * For geo.admin WM(T)S hosts (e.g. "wms.geo.admin.ch"), maps to the matching api3 host.
   * For external hosts, strips WM(T)S path suffixes and preserves any path prefix.
   * Falls back to the default geo.admin API if no serviceUrl is set or parsing fails.
   */
  private deriveRestApiBaseUrl(): string {
    const { serviceUrl, source } = this.controller.layer;
    if (
      serviceUrl === null ||
      (source !== WmtsLayerSource.WMS && source !== WmtsLayerSource.WMTS)
    ) {
      return `${DEFAULT_GEO_ADMIN_API_URL}/`;
    }

    try {
      const parsed = new URL(serviceUrl);
      const hostname = parsed.hostname.toLowerCase();
      if (hostname.startsWith('api3.')) {
        return `${parsed.origin}/`;
      }

      // Convert WM(T)S hosts like "wms.geo.admin.ch" or "wmts.dev.geo.admin.ch" to matching api3 hosts.
      const convertedHost = hostname.replace(/^(?:wms|wmts)[^.]*\./, 'api3.');
      if (convertedHost !== hostname) {
        return `${parsed.protocol}//${convertedHost}/`;
      }

      // Keep custom path prefixes, but strip WM(T)S endpoint suffixes.
      // Strip trailing slashes without a regex to avoid any ReDoS surface.
      const rawPathname = parsed.pathname;
      let trimEnd = rawPathname.length;
      while (trimEnd > 0 && rawPathname[trimEnd - 1] === '/') trimEnd--;
      let strippedPathname = rawPathname.slice(0, trimEnd);

      // Strip WM(T)S endpoint suffixes using plain endsWith checks (case-insensitive).
      const WMS_SUFFIXES = [
        '/gwc/service/wmts',
        '/service/wmts',
        '/wmts',
        '/wms',
      ];
      const lowerPathname = strippedPathname.toLowerCase();
      for (const suffix of WMS_SUFFIXES) {
        if (lowerPathname.endsWith(suffix)) {
          strippedPathname = strippedPathname.slice(
            0,
            strippedPathname.length - suffix.length,
          );
          break;
        }
      }
      const pathPrefix = strippedPathname;
      const normalizedPrefix = pathPrefix.length > 0 ? `${pathPrefix}/` : '/';
      return `${parsed.origin}${normalizedPrefix}`;
    } catch {
      return `${DEFAULT_GEO_ADMIN_API_URL}/`;
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

interface ServiceFeatureInfoFeature {
  properties?: Record<string, unknown> | null;
  geometry?: IdentifiedGeometry | null;
}

interface ServiceFeatureInfoResponse {
  features?: ServiceFeatureInfoFeature[];
}
