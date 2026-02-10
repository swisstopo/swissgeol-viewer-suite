import { API_BY_PAGE_HOST } from 'src/constants';
import { BaseService } from 'src/services/base.service';
import { SessionService } from 'src/features/session';
import {
  BaseLayer,
  EarthquakesLayer,
  FilterOperator,
  getTranslationKeyForLayerAttributeName,
  GeoJsonLayer,
  KmlLayer,
  Layer,
  LayerGroup,
  LayerSource,
  LayerSourceType,
  LayerType,
  TiffLayer,
  TiffLayerBand,
  TiffLayerConfigDisplay,
  Tiles3dLayer,
  VOXEL_UNDEFINED_COLOR,
  VoxelItemMapping,
  VoxelItemMappingItem,
  VoxelLayer,
  VoxelLayerMapping,
  VoxelLayerMappingType,
  VoxelRangeMapping,
  WmtsLayer,
} from 'src/features/layer';
import { Id } from 'src/models/id.model';
import { firstValueFrom } from 'rxjs';
import { WmtsService } from 'src/services/wmts.service';
import { run } from 'src/utils/fn.utils';

export class LayerApiService extends BaseService {
  private sessionService!: SessionService;
  private wmtsService!: WmtsService;

  constructor() {
    super();

    SessionService.inject$().subscribe((sessionService) => {
      this.sessionService = sessionService;
    });

    WmtsService.inject$().subscribe((wmtsService) => {
      this.wmtsService = wmtsService;
    });
  }

  async fetchLayerConfig(): Promise<LayersConfig> {
    const headers: HeadersInit = {};

    const { token } = this.sessionService;
    if (token !== null) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
      `${API_BY_PAGE_HOST[globalThis.location.host]}/layers`,
      {
        headers,
      },
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch layers: [HTTP ${response.status}] ${await response.text()}`,
      );
    }

    interface LayersConfigJson extends Omit<LayersConfig, 'layers'> {
      layers: object[];
    }

    const json: LayersConfigJson = await response.json();
    const config: LayersConfig = { ...json, layers: [] };
    await firstValueFrom(this.wmtsService.ready$);
    for (let i = 0; i < json.layers.length; i++) {
      const layer = this.mapConfigToLayer(
        new DynamicObject(json.layers[i], `layers.${i}`),
      );
      if (layer !== null) {
        config.layers.push(layer);
      }
    }
    return config;
  }

  private mapConfigToLayer(config: DynamicObject): Layer | null {
    const type: LayerType = config.take('type');
    const opacity: number | 'Disabled' = config.takeNullable('opacity') ?? 1;
    const canUpdateOpacity = opacity !== 'Disabled';
    const legend = run(() => {
      const legendValue: string | boolean | null =
        config.takeNullable('legend');
      if (legendValue === null) {
        return null;
      }
      return legendValue || null;
    });
    const base: BaseLayer = {
      type,
      label: null,
      id: config.take('id'),
      opacity: canUpdateOpacity ? opacity : 1,
      canUpdateOpacity,
      isVisible: false,
      geocatId: config.takeNullable('geocatId'),
      downloadUrl: config.takeNullable('downloadUrl'),
      customProperties: config.takeNullable('customProperties') ?? {},
      legend,
    };

    switch (type) {
      case LayerType.Wmts: {
        const specifics = config.apply(this.mapConfigToWmtsLayer);
        if (specifics === null) {
          return null;
        }
        return {
          ...specifics,
          ...base,
          id: base.id as Id<WmtsLayer>,
          type,
        } satisfies WmtsLayer;
      }
      case LayerType.Tiles3d:
        return {
          ...config.apply(this.mapConfigToTiles3dLayer),
          ...base,
          id: base.id as Id<Tiles3dLayer>,
          type,
        } satisfies Tiles3dLayer;
      case LayerType.Voxel:
        return {
          ...config.apply(this.mapConfigToVoxelLayer),
          ...base,
          id: base.id as Id<VoxelLayer>,
          type,
        } satisfies VoxelLayer;
      case LayerType.Tiff:
        return {
          ...config.apply(this.mapConfigToTiffLayer),
          ...base,
          id: base.id as Id<TiffLayer>,
          type,
        } satisfies TiffLayer;
      case LayerType.GeoJson:
        return {
          ...config.apply(this.mapConfigToGeoJsonLayer),
          ...base,
          canUpdateOpacity: true,
          id: base.id as Id<GeoJsonLayer>,
          type,
        } satisfies GeoJsonLayer;
      case LayerType.Kml:
        return {
          ...config.apply(this.mapConfigToKmlLayer),
          ...base,
          canUpdateOpacity: false,
          id: base.id as Id<KmlLayer>,
          type,
        } satisfies KmlLayer;
      case LayerType.Earthquakes:
        return {
          ...config.apply(this.mapConfigToEarthquakesLayer),
          ...base,
          id: base.id as Id<EarthquakesLayer>,
          type,
        } satisfies EarthquakesLayer;
      default:
        return null;
    }
  }

  private readonly mapConfigToWmtsLayer = (
    config: DynamicObject,
  ): Specific<WmtsLayer> | null => {
    const id: Id<WmtsLayer> = config.get('id');
    const def = this.wmtsService.layer(id);
    if (def === null) {
      console.error(
        `Layer not found in WMS/WMTS (layer will be ignored): ${id}`,
      );
      return null;
    }
    return {
      ...def,
      maxLevel: config.takeNullable('maxLevel'),
    };
  };

  private readonly mapConfigToTiles3dLayer = (
    config: DynamicObject,
  ): Specific<Tiles3dLayer> => ({
    orderOfProperties: config.takeNullable('orderOfProperties') ?? [],
    source: config.takeObject('source').apply(this.mapConfigToSource),
    isPartiallyTransparent: false,
  });

  private readonly mapConfigToVoxelLayer = (
    config: DynamicObject,
  ): Specific<VoxelLayer> => {
    const basic = config.takeKeys<VoxelLayer>()('dataKey', 'values');
    return {
      ...basic,
      source: config.takeObject('source').apply(this.mapConfigToSource),
      mappings: config.takeAll('mappings', (mapping) =>
        this.mapConfigToVoxelLayerMapping(mapping, {
          id: config.get('id'),
          values: basic.values,
        }),
      ),
      filterOperator: FilterOperator.And,
    };
  };

  private readonly mapConfigToVoxelLayerMapping = (
    config: DynamicObject,
    layer: Pick<VoxelLayer, 'id' | 'values'>,
  ): VoxelLayerMapping => {
    if (config.has('items')) {
      return {
        type: VoxelLayerMappingType.Item,
        key: config.take('key'),
        items: [
          {
            value: layer.values.undefined,
            label: getTranslationKeyForLayerAttributeName(
              { type: LayerType.Voxel, id: layer.id },
              'undefined',
            ),
            color: `rgb(${VOXEL_UNDEFINED_COLOR.join(', ')})`,
            isEnabled: true,
          },
          ...config.takeAll('items', (item) => ({
            ...item.takeKeys<VoxelItemMappingItem>()('label', 'value', 'color'),
            isEnabled: true,
          })),
        ],
      } satisfies VoxelItemMapping;
    }
    const range = config.take<[number, number]>('range');
    return {
      type: VoxelLayerMappingType.Range,
      ...config.takeKeys<VoxelRangeMapping>()('key', 'colors'),
      range,
      enabledRange: range,
      isUndefinedAlwaysEnabled: true,
    } satisfies VoxelRangeMapping;
  };

  private readonly mapConfigToTiffLayer = (
    config: DynamicObject,
  ): Specific<TiffLayer> => ({
    source: config.takeObject('source').apply(this.mapConfigToSource),
    terrain:
      config.takeNullableObject('terrain')?.apply(this.mapConfigToSource) ??
      null,
    cellSize: config.take('cellSize'),
    bandIndex: 0,
    bands: config.takeAll(
      'bands',
      (band): TiffLayerBand => ({
        ...band.takeKeys<TiffLayerBand>()('index', 'name'),
        unit: band.takeNullable('unit') ?? null,
        display:
          band
            .takeNullableObject('display')
            ?.apply((display): TiffLayerConfigDisplay => {
              const [a, b] = display.take<[number, number]>('bounds');
              const [min, max, direction] =
                a < b ? [a, b, 'asc' as const] : [b, a, 'desc' as const];
              return {
                bounds: [min, max],
                direction,
                colorMap: display.take('colorMap'),
                noData: display.takeNullable('noData'),
                steps: display.takeNullable('steps') ?? [],
                isDiscrete: display.takeNullable('isDiscrete') ?? false,
              };
            }) ?? null,
      }),
    ),
  });

  private readonly mapConfigToEarthquakesLayer = (
    config: DynamicObject,
  ): Specific<EarthquakesLayer> => ({
    source: config.takeObject('source').apply(this.mapConfigToSource),
  });

  private readonly mapConfigToGeoJsonLayer = (
    config: DynamicObject,
  ): Specific<GeoJsonLayer> => ({
    source: config.takeObject('source').apply(this.mapConfigToSource),
    terrain:
      config.takeNullableObject('terrain')?.apply(this.mapConfigToSource) ??
      null,
    shouldClampToGround: config.takeNullable('shouldClampToGround') ?? true,
    orderOfProperties: config.takeNullable('orderOfProperties') ?? [],
  });

  private readonly mapConfigToKmlLayer = (
    config: DynamicObject,
  ): Specific<KmlLayer> => ({
    source: config.takeObject('source').apply(this.mapConfigToSource),
    shouldClampToGround: config.takeNullable('shouldClampToGround') ?? true,
  });

  private readonly mapConfigToSource = (config: DynamicObject): LayerSource => {
    switch (config.take<LayerSourceType>('type')) {
      case LayerSourceType.CesiumIon:
        return {
          type: LayerSourceType.CesiumIon,
          assetId: config.take('assetId'),
        };
      case LayerSourceType.Url:
        return {
          type: LayerSourceType.Url,
          url: config.take('url'),
        };
      case LayerSourceType.S3:
        return {
          type: LayerSourceType.S3,
          bucket: config.take('bucket'),
          key: config.take('key'),
        };
      case LayerSourceType.Ogc:
        return {
          type: LayerSourceType.Ogc,
          id: config.take('id'),
          styleId: config.takeNullable('styleId') ?? undefined,
          displaySource:
            config
              .takeNullableObject('displaySource')
              ?.apply(this.mapConfigToSource) ?? undefined,
        };
    }
  };
}

type Specific<L extends Layer> = Omit<L, keyof BaseLayer>;
class DynamicObject {
  readonly keyCount: number;
  private readonly unusedKeys: Set<string>;

  constructor(
    private readonly object: object,
    private readonly path: string | null = null,
  ) {
    const keys = Object.keys(this.object);
    this.keyCount = keys.length;
    this.unusedKeys = new Set(keys);
  }

  has(key: string): boolean {
    return key in this.object;
  }

  takeEverything(): object {
    this.unusedKeys.clear();
    return this.object;
  }

  take<T>(key: string): T {
    const value = this.get<T>(key);
    this.unusedKeys.delete(key);
    return value;
  }

  takeNullable<T>(key: string): T | null {
    if (!(key in this.object)) {
      return null;
    }
    return this.take<T>(key);
  }

  takeObject(key: string): DynamicObject {
    const value = this.take<object>(key);
    return new DynamicObject(value, this.joinPath(key));
  }

  takeNullableObject(key: string): DynamicObject | null {
    const value = this.takeNullable<object | null>(key);
    if (value === null) {
      return null;
    }
    return new DynamicObject(value, this.joinPath(key));
  }

  takeAll<T>(key: string, transform: (object: DynamicObject) => T | null): T[] {
    const values = this.get<object[]>(key);
    this.unusedKeys.delete(key);
    return values.reduce((acc: T[], value, i) => {
      const object = new DynamicObject(value, this.joinPath(`${key}.${i}`));
      const item = object.apply(transform);
      if (item !== null) {
        acc.push(item);
      }
      return acc;
    }, [] as T[]);
  }

  readonly takeKeys =
    <T>() =>
    <K extends keyof T & string>(...keys: K[]): Pick<T, K> => {
      const object = {} as Pick<T, K>;
      for (const key of keys) {
        object[key] = this.take(key);
      }
      return object;
    };

  get<T>(key: string): T {
    if (!(key in this.object)) {
      throw new Error(`Missing key "${key}" at ${this.path ?? '<root>'}.`);
    }
    return this.object[key] as T;
  }

  apply<T>(transform: (object: DynamicObject) => T): T {
    const result = transform(this);
    if (this.unusedKeys.size !== 0) {
      throw new Error(
        `Keys at ${this.path ?? '<root>'} have not been used: ${[...this.unusedKeys].join(', ')}`,
      );
    }
    return result;
  }

  private joinPath(suffix: string): string {
    return this.path === null ? suffix : `${this.path}.${suffix}`;
  }
}

export interface LayersConfig {
  layers: Layer[];
  groups: LayerGroupConfig[];
}

export interface LayerGroupConfig {
  id: Id<LayerGroup>;
  children: Array<LayerGroupConfig | Id<Layer>>;
}
