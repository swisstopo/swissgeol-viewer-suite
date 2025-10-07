import { LayerGroup } from 'src/features/layer/models/layer-group.model';
import { API_BY_PAGE_HOST } from 'src/constants';
import { BaseService } from 'src/utils/base.service';
import { SessionService } from 'src/features/session';
import {
  BaseLayer,
  ConductivityVoxelLayerFilter,
  Layer,
  LayerType,
  LithologyVoxelLayerFilter,
  LithologyVoxelLayerFilterItem,
  SwisstopoLayer,
  TiffLayer,
  TiffLayerBand,
  TiffLayerConfigDisplay,
  Tiles3dLayer,
  Tiles3dLayerSource,
  Tiles3dLayerSourceForCesium,
  Tiles3dLayerSourceForEarthquakes,
  Tiles3dLayerSourceType,
  VoxelLayer,
  VoxelLayerFilter,
  VoxelLayerMapping,
} from 'src/features/layer';
import { Id } from 'src/models/id.model';
import { firstValueFrom, Observable } from 'rxjs';
import { WmtsService } from 'src/services/wmts.service';

export class LayerApiService extends BaseService {
  private sessionService!: SessionService;
  private wmtsService!: WmtsService;

  constructor() {
    super();

    SessionService.inject().subscribe((sessionService) => {
      this.sessionService = sessionService;
    });

    WmtsService.inject().subscribe((wmtsService) => {
      this.wmtsService = wmtsService;
    });
  }

  async fetchLayers(): Promise<LayerGroup[]> {
    const headers: HeadersInit = {};

    const { token } = this.sessionService;
    if (token !== null) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
      `${API_BY_PAGE_HOST[window.location.host]}/layers`,
      {
        headers,
      },
    );
    const groups: object[] = await response.json();
    await firstValueFrom(this.wmtsService.ready$);
    return groups.map((group, i) =>
      this.mapConfigToGroup(new DynamicObject(group, `${i}`)),
    );
  }

  private mapConfigToGroup(config: DynamicObject) {
    return {
      id: config.take('id'),
      children: config.takeAll('children', (child) =>
        child.keyCount === 2
          ? this.mapConfigToGroup(child)
          : this.mapConfigToLayer(child),
      ),
    };
  }

  private mapConfigToLayer(config: DynamicObject): Layer | null {
    const type: LayerType = config.take('type');
    const opacity: number | 'Disabled' = config.take('opacity');
    const canUpdateOpacity = opacity !== 'Disabled';
    const base: BaseLayer = {
      type,
      label: null,
      id: config.take('id'),
      opacity: canUpdateOpacity ? opacity : 1,
      canUpdateOpacity,
      isVisible: opacity !== 0,
      geocatId: config.take('geocatId'),
      downloadUrl: config.take('downloadUrl'),
    };

    switch (type) {
      case LayerType.Background:
        // TODO move background config into API
        throw new Error(
          'Background layers are currently not defined via API config',
        );
      case LayerType.Swisstopo: {
        const specifics = config.apply(this.mapConfigToSwisstopoLayer);
        if (specifics === null) {
          return null;
        }
        return {
          ...specifics,
          ...base,
          type,
        } satisfies SwisstopoLayer;
      }
      case LayerType.Tiles3d:
        return {
          ...config.apply(this.mapConfigToTiles3dLayer),
          ...base,
          type,
        } satisfies Tiles3dLayer;
      case LayerType.Voxel:
        return {
          ...config.apply(this.mapConfigToVoxelLayer),
          ...base,
          type,
        } satisfies VoxelLayer;
      case LayerType.Tiff:
        return {
          ...config.apply(this.mapConfigToTiffLayer),
          ...base,
          type,
        } satisfies TiffLayer;
    }
  }

  private readonly mapConfigToSwisstopoLayer = (
    config: DynamicObject,
  ): Specific<SwisstopoLayer> | null => {
    const id: Id<Layer> = config.get('id');
    const def = this.wmtsService.layer(id);
    if (def === null) {
      console.error(
        `Swisstopo layer not found in WMS/WMTS (layer will be ignored): ${id}`,
      );
      return null;
    }
    return {
      ...def,
      ...config.takeKeys<SwisstopoLayer>()('maxLevel', 'hasLegend'),
    };
  };

  private readonly mapConfigToTiles3dLayer = (
    config: DynamicObject,
  ): Specific<Tiles3dLayer> => ({
    ...config.takeKeys<Tiles3dLayer>()('orderOfProperties'),
    source: config.takeObject('source').apply((source): Tiles3dLayerSource => {
      switch (source.take<Tiles3dLayerSourceType>('type')) {
        case Tiles3dLayerSourceType.CesiumIon:
          return {
            type: Tiles3dLayerSourceType.CesiumIon,
            assetId: source.take('assetId'),
          } satisfies Tiles3dLayerSourceForCesium;
        case Tiles3dLayerSourceType.Earthquakes:
          return {
            type: Tiles3dLayerSourceType.Earthquakes,
            url: source.take('url'),
          } satisfies Tiles3dLayerSourceForEarthquakes;
      }
    }),
  });

  private readonly mapConfigToVoxelLayer = (
    config: DynamicObject,
  ): Specific<VoxelLayer> => ({
    ...config.takeKeys<VoxelLayer>()('url', 'unitLabel', 'dataKey', 'noData'),
    mapping: config
      .takeObject('mapping')
      .apply(
        (mapping): VoxelLayerMapping =>
          mapping.takeKeys<VoxelLayerMapping>()('range', 'colors'),
      ),
    filter: config.takeObject('filter').apply(
      (filter): VoxelLayerFilter => ({
        lithology:
          filter.takeNullableObject('lithology')?.apply(
            (lithology): LithologyVoxelLayerFilter => ({
              key: lithology.take('key'),
              items: lithology.takeAll('items', (item) =>
                item.takeKeys<LithologyVoxelLayerFilterItem>()(
                  'label',
                  'value',
                ),
              ),
            }),
          ) ?? null,
        conductivity:
          filter
            .takeNullableObject('conductivity')
            ?.apply(
              (conductivity): ConductivityVoxelLayerFilter =>
                conductivity.takeKeys<ConductivityVoxelLayerFilter>()(
                  'key',
                  'range',
                ),
            ) ?? null,
      }),
    ),
  });

  private readonly mapConfigToTiffLayer = (
    config: DynamicObject,
  ): Specific<TiffLayer> => ({
    ...config.takeKeys<TiffLayer>()('url', 'cellSize'),
    bands: config.takeAll(
      'bands',
      (band): TiffLayerBand => ({
        ...band.takeKeys<TiffLayerBand>()('index', 'name', 'unit'),
        display:
          band
            .takeNullableObject('display')
            ?.apply((display) =>
              display.takeKeys<TiffLayerConfigDisplay>()(
                'bounds',
                'noData',
                'steps',
                'colorMap',
                'isDiscrete',
              ),
            ) ?? null,
      }),
    ),
  });
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

  take<T>(key: string): T {
    const value = this.get<T>(key);
    this.unusedKeys.delete(key);
    return value;
  }

  takeObject(key: string): DynamicObject {
    const value = this.take<object>(key);
    return new DynamicObject(value, this.joinPath(key));
  }

  takeNullableObject(key: string): DynamicObject | null {
    const value = this.take<object | null>(key);
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

export interface DefinedLayers {
  groups: LayerGroupDefinition[];
  layers: Array<Observable<LayerDefinition>>;
}

export interface LayerGroupDefinition {
  id: Id<LayerGroup>;
  parentId: Id<LayerGroup> | null;
}

export interface LayerDefinition {
  layer: Layer;
  groupId: Id<LayerGroup>;
}
