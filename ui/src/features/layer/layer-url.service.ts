import { BaseService } from 'src/utils/base.service';
import {
  LayerService,
  LayerUpdate,
} from 'src/features/layer/new/layer.service';
import {
  combineLatest,
  debounceTime,
  identity,
  map,
  of,
  switchMap,
} from 'rxjs';
import {
  BACKGROUND_LAYER,
  BackgroundLayer,
  BackgroundLayerVariant,
  DEFAULT_BACKGROUND_VARIANT,
  Layer,
  LayerType,
  WmtsLayer,
} from 'src/features/layer/models';
import { Id, makeId } from 'src/models/id.model';

export class LayerUrlService extends BaseService {
  private layerService!: LayerService;

  constructor() {
    super();

    LayerService.inject().then(async (layerService) => {
      this.layerService = layerService;
      await this.initialize();
    });
  }

  private async initialize(): Promise<void> {
    const params = this.readParams();
    await this.layerService.ready;
    this.syncParamsToLayers(params.layers);
    this.syncParamsToBackground(params.background);

    this.layerService.activeLayerIds$
      .pipe(
        switchMap((ids) => {
          if (ids.length === 0) {
            return of([]);
          }
          return combineLatest(ids.map((id) => this.layerService.layer$(id)));
        }),
        debounceTime(250),
        map(this.makeLayerParams),
      )
      .subscribe((params) =>
        this.writeParams((url) => this.writeLayerParams(params, url)),
      );

    this.layerService
      .layer$(BACKGROUND_LAYER.id)
      .pipe(debounceTime(250), map(this.makeBackgroundParams))
      .subscribe((params) =>
        this.writeParams((url) => this.writeBackgroundParams(params, url)),
      );
  }

  private readParams(): Params {
    const url = new URL(window.location.href);
    return {
      layers: {
        layers: this.getLayerParamFromUrl(url, 'layers') as Array<Id<Layer>>,
        visibility: this.getLayerParamFromUrl(url, 'visibility').map(Boolean),
        transparency: this.getLayerParamFromUrl(url, 'transparency').map(
          Number,
        ),
        timestamp: this.getLayerParamFromUrl(url, 'timestamp').map((it) =>
          it === '' ? 'current' : it,
        ),
      },
      background: {
        map:
          (this.getBackgroundParamFromUrl(
            url,
            'map',
          ) as Id<BackgroundLayerVariant>) ?? DEFAULT_BACKGROUND_VARIANT.id,
        transparency: Number(
          this.getBackgroundParamFromUrl(url, 'transparency') ?? '0',
        ),
      },
    };
  }

  private syncParamsToLayers(params: LayerParams): void {
    for (let i = params.layers.length - 1; i >= 0; i--) {
      const id = params.layers[i];
      this.layerService.activate(id);

      const update: LayerUpdate = {
        isVisible: params.visibility[i] ?? true,
        opacity: 1 - (params.transparency[i] ?? 0),
      };

      const layer = this.layerService.layer(id);
      const timestamp = params.timestamp[i] ?? 'current';
      if (layer.type === LayerType.Wmts && timestamp !== 'current') {
        (update as LayerUpdate<WmtsLayer>).times = {
          ...layer.times!,
          current: timestamp,
        };
      }

      this.layerService.update(id, update);
    }
  }

  private syncParamsToBackground(params: BackgroundParams): void {
    const isVisible = params.map !== 'empty_map';
    const update: LayerUpdate<BackgroundLayer> = {
      activeVariantId: isVisible ? params.map : DEFAULT_BACKGROUND_VARIANT.id,
      opacity: 1 - (params.transparency ?? 0),
    };
    this.layerService.update(BACKGROUND_LAYER.id, update);

    // Update visibility in a later step so it doesn't get overwritten by opacity.
    this.layerService.update(BACKGROUND_LAYER.id, { isVisible });
  }

  private makeLayerParams = (layers: Layer[]): LayerParams => {
    const params = makeEmptyLayerParams();
    for (const layer of layers) {
      params.layers.push(layer.id);
      params.visibility.push(layer.isVisible);
      params.transparency.push(Number((1 - layer.opacity).toFixed(2)));

      const timestamp =
        (layer.type === LayerType.Wmts && layer.times?.current) || '';
      params.timestamp.push(timestamp === 'current' ? '' : timestamp);
    }
    if (params.timestamp.every((it) => it === '')) {
      params.timestamp = [];
    }
    if (params.visibility.every(identity)) {
      params.visibility = [];
    }
    return params;
  };

  private makeBackgroundParams = (layer: BackgroundLayer): BackgroundParams => {
    return {
      map: layer.isVisible ? layer.activeVariantId : makeId('empty_map'),
      transparency: 1 - layer.opacity,
    };
  };

  private writeParams = (write: (url: URL) => void): void => {
    const url = new URL(window.location.href);
    write(url);
    history.replaceState(null, '', url.toString().replace(/%2C/g, ','));
  };

  private writeLayerParams(params: LayerParams, url: URL): void {
    for (const [key, values] of Object.entries(params) as Array<
      [keyof LayerParams, LayerParams[keyof LayerParams]]
    >) {
      const name = getLayerParamName(key);
      if (values.length === 0) {
        url.searchParams.delete(name);
      } else {
        url.searchParams.set(
          name,
          values
            .map((it: (typeof values)[0]) => encodeURIComponent(String(it)))
            .join(','),
        );
      }
    }
  }

  private writeBackgroundParams(params: BackgroundParams, url: URL): void {
    const mapName = getBackgroundParamName('map');
    if (params.map === DEFAULT_BACKGROUND_VARIANT.id) {
      url.searchParams.delete(mapName);
    } else {
      url.searchParams.set(mapName, String(params.map));
    }

    const transparencyName = getBackgroundParamName('transparency');
    if (params.transparency === 0) {
      url.searchParams.delete(transparencyName);
    } else {
      url.searchParams.set(transparencyName, params.transparency.toFixed(2));
    }
  }

  private getLayerParamFromUrl(url: URL, key: keyof LayerParams): string[] {
    const name = getLayerParamName(key);
    const value = url.searchParams.get(name);
    return value === null ? [] : value.split(',');
  }

  private getBackgroundParamFromUrl(
    url: URL,
    key: keyof BackgroundParams,
  ): string | null {
    const name = getBackgroundParamName(key);
    return url.searchParams.get(name);
  }
}

interface Params {
  layers: LayerParams;
  background: BackgroundParams;
}

interface LayerParams {
  layers: Array<Id<Layer>>;
  visibility: boolean[];
  transparency: number[];
  timestamp: string[];
}

interface BackgroundParams {
  map: Id<BackgroundLayerVariant>;
  transparency: number;
}

const makeEmptyLayerParams = (): LayerParams => ({
  layers: [],
  visibility: [],
  transparency: [],
  timestamp: [],
});

const getLayerParamName = (key: keyof LayerParams): string =>
  key === 'layers' ? key : `layers_${key}`;

const getBackgroundParamName = (key: keyof BackgroundParams): string =>
  key === 'map' ? key : `map_${key}`;
