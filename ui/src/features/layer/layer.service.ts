import { BaseService } from 'src/utils/base.service';
import {
  GeoTIFFLayer,
  LayerConfig,
  LayerTreeNode,
  LayerType,
} from 'src/layertree';
import {
  BehaviorSubject,
  map,
  mergeMap,
  Observable,
  of,
  pairwise,
  share,
} from 'rxjs';
import { syncLayersParam } from 'src/permalink';
import { createCesiumObject } from 'src/layers/helpers';
import { CustomDataSource, ImageryLayer, Viewer } from 'cesium';
import MainStore from 'src/store/main';

export class LayerService extends BaseService {
  private readonly layersSubject = new BehaviorSubject<
    readonly LayerTreeNode[]
  >([]);

  private readonly layerChanges$ = this.activeLayers$.pipe(
    pairwise(),
    map(([oldLayers, newLayers]) => makeLayerDiff(oldLayers, newLayers)),
    share(),
  );

  private viewer!: Viewer;

  constructor() {
    super();

    MainStore.viewer.subscribe((viewer) => {
      if (viewer !== null) {
        this.viewer = viewer;
      }
    });
  }

  private readonly queryableLayersObservable = this.layersSubject.pipe(
    map((layers) => layers.filter((layer) => layer.visible && !layer.noQuery)),
  );

  get activeLayers(): readonly LayerTreeNode[] {
    return this.layersSubject.value;
  }

  get activeLayers$(): Observable<readonly LayerTreeNode[]> {
    return this.layersSubject.asObservable();
  }

  get layerActivated$(): Observable<LayerTreeNode> {
    return this.layerChanges$.pipe(
      mergeMap((changes) => of(...changes.activated)),
    );
  }

  get layerDeactivated$(): Observable<LayerTreeNode> {
    return this.layerChanges$.pipe(
      mergeMap((changes) => of(...changes.deactivated)),
    );
  }

  get queryableLayers$(): Observable<readonly LayerTreeNode[]> {
    return this.queryableLayersObservable;
  }

  set(layers: readonly LayerTreeNode[]): void {
    const diff = makeLayerDiff(this.activeLayers, layers);
    for (const newLayer of diff.activated) {
      this.mutateLayerToBeActive(newLayer);
    }
    for (const newLayer of diff.deactivated) {
      this.mutateLayerToBeInactive(newLayer);
    }
    this.reorderLayers(layers as LayerConfig[]).then(() => {
      this.layersSubject.next(layers);
      syncLayersParam(this);
    });
  }

  activate(layer: LayerTreeNode): void {
    layer.visible = true;
    this.mutateLayerToBeActive(layer);
    this.layersSubject.next([...this.layersSubject.value, layer]);
    syncLayersParam(this);
  }

  deactivate(layer: LayerTreeNode): void {
    const layers = [...this.layersSubject.value];
    const i = layers.findIndex((it) => isSameLayer(layer, it));
    if (i < 0) {
      return;
    }
    this.mutateLayerToBeInactive(layer);
    layers.splice(i, 1);
    this.layersSubject.next(layers);
    syncLayersParam(this);
  }

  toggle(layer: LayerTreeNode): void {
    if (layer.displayed) {
      this.deactivate(layer);
    } else {
      this.activate(layer);
    }
  }

  private mutateLayerToBeActive(layer: LayerTreeNode): void {
    const config = layer as LayerConfig;
    if (!layer.displayed) {
      if (config.promise === undefined && config.load !== undefined) {
        config.promise = config.load();
      }
      config.promise ??= createCesiumObject(this.viewer, layer);
      config.add && (config.add as () => void)();
      // this.maybeShowVisibilityHint(layer); TODO
    }
    layer.displayed = true;
    config.setVisibility?.(layer.visible ?? true);
  }

  private mutateLayerToBeInactive(layer: LayerTreeNode): void {
    const config = layer as LayerConfig;
    if (layer.displayed) {
      layer.displayed = false;
      layer.visible = false;
      config.remove?.();
    }
  }

  private async reorderLayers(newLayers: LayerConfig[]) {
    const imageries = this.viewer.scene.imageryLayers;
    const dataSources = this.viewer.dataSources;
    for (const config of newLayers) {
      const layer = await config.promise;
      if (
        config.type === LayerType.swisstopoWMTS &&
        layer instanceof ImageryLayer
      ) {
        imageries.raiseToTop(layer);
      } else if (
        layer instanceof CustomDataSource &&
        dataSources.contains(layer)
      ) {
        dataSources.raiseToTop(layer);
      } else if (config.type === LayerType.geoTIFF) {
        const imagery = (config as GeoTIFFLayer).controller!.activeImagery;
        imageries.raiseToTop(imagery);
      }
    }
  }
}

export const isSameLayer = (a: LayerTreeNode, b: LayerTreeNode): boolean =>
  a === b ||
  (a.layer != null && a.layer === b.layer) ||
  (a.assetId != null && a.assetId === b.assetId);

interface LayerDiff {
  activated: readonly LayerTreeNode[];
  deactivated: readonly LayerTreeNode[];
}

const makeLayerDiff = (
  oldLayers: readonly LayerTreeNode[],
  newLayers: readonly LayerTreeNode[],
): LayerDiff => {
  const activatedLayers = [...newLayers];
  const deactivatedLayers: LayerTreeNode[] = [];
  for (const oldLayer of oldLayers) {
    const i = activatedLayers.findIndex((it) => isSameLayer(it, oldLayer));
    if (i < 0) {
      deactivatedLayers.push(oldLayer);
    } else {
      activatedLayers.splice(i, 1);
    }
  }
  return { activated: activatedLayers, deactivated: deactivatedLayers };
};
