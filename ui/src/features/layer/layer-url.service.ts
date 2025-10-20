import { BaseService } from 'src/utils/base.service';
import {
  LayerService,
  LayerUpdate,
} from 'src/features/layer/new/layer.service';
import { combineLatest, debounceTime, identity, map, switchMap } from 'rxjs';
import { Layer, LayerType, SwisstopoLayer } from 'src/features/layer/models';
import { Id } from 'src/models/id.model';

export class LayerUrlService extends BaseService {
  private layerService!: LayerService;

  constructor() {
    super();

    LayerService.inject().subscribe((layerService) => {
      this.layerService = layerService;
      this.initialize();
    });
  }

  private async initialize(): Promise<void> {
    const params = this.readParams();
    await this.layerService.ready;
    this.syncParamsToLayers(params);

    this.layerService.activeLayerIds$
      .pipe(
        switchMap((ids) =>
          combineLatest(ids.map((id) => this.layerService.layer$(id))),
        ),
        debounceTime(250),
        map(this.makeParams),
      )
      .subscribe(this.writeParams);
  }

  private readParams(): Params {
    const url = new URL(window.location.href);
    return {
      layers: this.getParamFromUrl(url, 'layers') as Array<Id<Layer>>,
      visibility: this.getParamFromUrl(url, 'visibility').map(Boolean),
      transparency: this.getParamFromUrl(url, 'transparency').map(Number),
      timestamp: this.getParamFromUrl(url, 'timestamp').map((it) =>
        it === '' ? 'current' : it,
      ),
    };
  }

  private syncParamsToLayers(params: Params): void {
    for (let i = params.layers.length - 1; i >= 0; i--) {
      const id = params.layers[i];
      this.layerService.activate(id);

      const update: LayerUpdate = {
        isVisible: params.visibility[i] ?? true,
        opacity: 1 - (params.transparency[i] ?? 0),
      };

      const layer = this.layerService.layer(id);
      const timestamp = params.timestamp[i] ?? 'current';
      if (layer.type === LayerType.Swisstopo && timestamp !== 'current') {
        (update as LayerUpdate<SwisstopoLayer>).times = {
          ...layer.times!,
          current: timestamp,
        };
      }

      this.layerService.update(id, update);
    }
  }

  private makeParams = (layers: Layer[]): Params => {
    const params = makeEmptyParams();
    for (const layer of layers) {
      params.layers.push(layer.id);
      params.visibility.push(layer.isVisible);
      params.transparency.push(Number((1 - layer.opacity).toFixed(2)));

      const timestamp =
        (layer.type === LayerType.Swisstopo && layer.times?.current) || '';
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

  private writeParams = (params: Params): void => {
    const url = new URL(window.location.href);

    for (const [key, values] of Object.entries(params) as Array<
      [keyof Params, Params[keyof Params]]
    >) {
      const name = getParamName(key);
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
    history.replaceState(null, '', url.toString().replace(/%2C/g, ','));
  };

  private getParamFromUrl(url: URL, key: keyof Params): string[] {
    const name = getParamName(key);
    const value = url.searchParams.get(name);
    return value === null ? [] : value.split(',');
  }
}

interface Params {
  layers: Array<Id<Layer>>;
  visibility: boolean[];
  transparency: number[];
  timestamp: string[];
}

const makeEmptyParams = (): Params => ({
  layers: [],
  visibility: [],
  transparency: [],
  timestamp: [],
});

const getParamName = (key: keyof Params): string =>
  key === 'layers' ? key : `layers_${key}`;
