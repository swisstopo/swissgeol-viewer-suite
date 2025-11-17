import { BaseService } from 'src/utils/base.service';
import { SessionService } from 'src/features/session';
import {
  BehaviorSubject,
  combineLatest,
  concatMap,
  filter,
  firstValueFrom,
  from,
  map,
  Observable,
  pairwise,
  shareReplay,
  startWith,
  switchMap,
  take,
} from 'rxjs';
import {
  LayerApiService,
  LayerGroupConfig,
} from 'src/features/layer/new/layer-api.service';
import { Id } from 'src/models/id.model';
import { Layer, LayerGroup, LayerType, WmtsLayer } from 'src/features/layer';
import { WmtsService } from 'src/services/wmts.service';
import {
  BaseLayerController,
  LayerController,
} from 'src/features/layer/new/controllers/layer.controller';
import { WmtsLayerController } from 'src/features/layer/new/controllers/layer-wmts.controller';
import { Viewer } from 'cesium';
import MainStore from 'src/store/main';
import { Tiles3dLayerController } from 'src/features/layer/new/controllers/layer-tiles3d.controller';

export class LayerService extends BaseService {
  private viewer!: Viewer;

  private layerApiService!: LayerApiService;

  private layers: IdMapping<Layer, LayerEntry> = new Map();

  private groups: IdMapping<LayerGroup, GroupEntry> = new Map();

  private _rootGroupIds$ = new BehaviorSubject<IdArray<LayerGroup>>([]);

  /**
   * The ids of all currently active layers.
   *
   * Activating a layer adds them to the start of the array.
   * The first layer is the topmost one, the last the lowermost one.
   *
   * Each layer registered here has a `controller` defined.
   *
   * @private
   */
  private readonly _activeLayerIds$ = new BehaviorSubject<IdArray<Layer>>([]);

  private readonly hasLayers$ = new BehaviorSubject(false);
  private readonly hasViewer$ = new BehaviorSubject(false);

  private readonly _layerChanges$ = this._activeLayerIds$.pipe(
    pairwise(),
    map(([previous, current]) => {
      const oldSet = new Set(previous);
      const newSet = new Set(current);

      const deactivated: Array<Id<Layer>> = [];
      for (const element of previous) {
        if (!newSet.has(element)) {
          deactivated.push(element);
        }
      }

      const activated: Array<Id<Layer>> = [];
      for (const element of current) {
        if (!oldSet.has(element)) {
          activated.push(element);
        }
      }

      return { activated, deactivated };
    }),
    shareReplay(1),
  );

  private readonly _layerActivated$ = this._layerChanges$.pipe(
    concatMap(({ activated }) => from(activated)),
  );

  private readonly _layerDeactivated$ = this._layerChanges$.pipe(
    concatMap(({ deactivated }) => from(deactivated)),
  );

  constructor() {
    super();

    MainStore.viewer.subscribe((viewer) => {
      if (viewer !== null) {
        this.viewer = viewer;
        this.hasViewer$.next(true);
      }
    });

    LayerApiService.inject().then((service) => {
      this.layerApiService = service;
    });

    SessionService.inject$()
      .pipe(
        switchMap((service) =>
          service.initialized$.pipe(switchMap(() => service.user$)),
        ),
      )
      .subscribe(() => this.loadLayers());

    WmtsService.inject$()
      .pipe(
        filter(() => this.hasLayers$.value),
        switchMap((wmtsService) => wmtsService.layers$),
      )
      .subscribe((layers) => this.syncWmtsLayers(layers));
  }

  private syncWmtsLayers(layers: WmtsLayer[]) {
    for (const layer of layers) {
      const entry = this.layers.get(layer.id);
      if (entry === undefined) {
        continue;
      }
      const fields = {
        format: layer.format,
        credit: layer.credit,
        times: layer.times,
      } satisfies Partial<WmtsLayer>;

      const updatedState: WmtsLayer = {
        ...(entry.state$.value as WmtsLayer),
        ...fields,
      };

      const updatedDefinition: WmtsLayer = {
        ...(entry.definition as WmtsLayer),
        ...fields,
      };

      if (updatedState.label !== null) {
        updatedState.label = layer.label;
      }

      if (updatedDefinition.label !== null) {
        updatedDefinition.label = layer.label;
      }

      entry.definition = updatedDefinition;
      entry.state$.next(updatedState);
    }
  }

  private async loadLayers() {
    const insertLayer = (layer: Layer): void => {
      const previousLayer = previousLayers.get(layer.id);
      const entry = {
        definition: layer,
        groups: [],
      } satisfies Partial<LayerEntry>;
      if (previousLayer === undefined) {
        this.layers.set(layer.id, {
          ...entry,
          controller: null,
          state$: new BehaviorSubject(layer),
        });
      } else {
        previousLayers.delete(layer.id);
        const updated: LayerEntry = {
          ...entry,
          controller: previousLayer.controller,
          state$: previousLayer.state$,
        };
        this.layers.set(layer.id, updated);
        (updated.controller as BaseLayerController | null)?.update(layer);
        updated.state$.next(layer);
      }
    };

    const insertNode = (
      node: LayerGroupConfig | Id<Layer>,
      groupId: Id<LayerGroup>,
    ): TreeNode => {
      if (typeof node === 'object') {
        insertGroup(node, groupId);
        return { type: TreeNodeType.Group, id: node.id };
      } else {
        insertLayerIntoGroup(node, groupId);
        return { type: TreeNodeType.Layer, id: node };
      }
    };

    const insertLayerIntoGroup = (
      id: Id<Layer>,
      groupId: Id<LayerGroup>,
    ): void => {
      const layer = this.layers.get(id);
      if (layer === undefined) {
        throw new Error(`Unknown layer: ${id}`);
      }
      layer.groups = [...layer.groups, groupId];
    };

    const insertGroup = (
      group: LayerGroupConfig,
      parent: Id<LayerGroup> | null,
    ): void => {
      const nodes: TreeNode[] = [];
      let count = 0;
      for (const node of group.children) {
        const inserted = insertNode(node, group.id);
        nodes.push(inserted);
        switch (inserted.type) {
          case TreeNodeType.Group:
            count += this.groups.get(inserted.id)!.count;
            break;
          case TreeNodeType.Layer:
            if (this._activeLayerIds$.value.includes(inserted.id)) {
              count += 1;
            }
            break;
        }
      }
      this.groups.set(group.id, { count, nodes, parent });
    };

    const config = await this.layerApiService.fetchLayerConfig();
    const rootGroupIds: Array<Id<LayerGroup>> = [];

    this.groups.clear();

    const previousLayers = new Map([...this.layers]);
    this.layers.clear();

    for (const layer of config.layers) {
      insertLayer(layer);
    }

    for (const group of config.groups) {
      rootGroupIds.push(group.id);
      insertGroup(group, null);
    }

    const activeLayers = this._activeLayerIds$.value.filter((it) =>
      this.layers.has(it),
    );

    for (const entry of previousLayers.values()) {
      entry.state$.complete();
    }

    this._activeLayerIds$.next(activeLayers);
    this._rootGroupIds$.next(rootGroupIds);

    this.hasLayers$.next(true);
  }

  get ready(): Promise<void> {
    return firstValueFrom(
      combineLatest([this.hasLayers$, this.hasViewer$]).pipe(
        filter(([a, b]) => a && b),
        take(1),
        map(() => {}),
      ),
    );
  }

  get rootGroupIds$(): Observable<ReadonlyArray<Id<LayerGroup>>> {
    return this._rootGroupIds$.asObservable();
  }

  groupCount$(id: Id<LayerGroup>): Observable<number> {
    return this.activeLayerIds$.pipe(
      map(() => this.groups.get(id)?.count ?? 0),
    );
  }

  getNodesOfGroup(id: Id<LayerGroup>): readonly TreeNode[] {
    const entry = this.groups.get(id);
    if (entry === undefined) {
      throw new Error(`Unknown group: ${id}`);
    }
    return entry.nodes;
  }

  layer<T extends Layer>(id: Id<T>): T {
    const entry = this.layers.get(id);
    if (entry === undefined) {
      throw new Error(`Unknown layer: ${id}`);
    }
    return entry.state$.value as T;
  }

  layer$<T extends Layer>(id: Id<T>): Observable<T> {
    const entry = this.layers.get(id);
    if (entry === undefined) {
      throw new Error(`Unknown layer: ${id}`);
    }
    return entry.state$.asObservable() as Observable<T>;
  }

  get activeLayerIds(): ReadonlyArray<Id<Layer>> {
    return this._activeLayerIds$.value;
  }

  get activeLayerIds$(): Observable<ReadonlyArray<Id<Layer>>> {
    return this._activeLayerIds$.asObservable();
  }

  isLayerActive(id: Id<Layer>): boolean {
    return this._activeLayerIds$.value.includes(id);
  }

  isLayerActive$(id: Id<Layer>): Observable<boolean> {
    return this._activeLayerIds$.pipe(map((layerIds) => layerIds.includes(id)));
  }

  get layerActivated$(): Observable<Id<Layer>> {
    return this._layerActivated$.pipe(
      startWith(...this._activeLayerIds$.value),
    );
  }

  get layerDeactivated$(): Observable<Id<Layer>> {
    return this._layerDeactivated$;
  }

  controller(id: Id<Layer>): LayerController | null {
    return this.layers.get(id)?.controller ?? null;
  }

  activate(id: Id<Layer>): void {
    const activeLayers = this._activeLayerIds$.value;
    if (activeLayers.includes(id)) {
      return;
    }

    const entry = this.layers.get(id)!;
    for (const groupId of entry.groups) {
      this.iterateGroupPath(groupId, (group) => {
        group.count += 1;
      });
    }
    const value = { ...entry.state$.value, isVisible: true } satisfies Layer;
    entry.controller = this.makeController(value);
    entry.state$.next(value);
    this._activeLayerIds$.next([id, ...activeLayers]);
    this.viewer.scene.requestRender();
  }

  deactivate(id: Id<Layer>): void {
    const activeLayers = this._activeLayerIds$.value;
    const i = activeLayers.indexOf(id);
    if (i < 0) {
      return;
    }

    const entry = this.layers.get(id)!;
    for (const groupId of entry.groups) {
      this.iterateGroupPath(groupId, (group) => {
        group.count -= 1;
      });
    }

    entry.controller!.remove();
    entry.controller = null;

    // Reset the state after removal.
    entry.state$.next(entry.definition);

    const updatedActiveLayers = [...activeLayers];
    updatedActiveLayers.splice(i, 1);
    this._activeLayerIds$.next(updatedActiveLayers);
    this.viewer.scene.requestRender();
  }

  update<T extends Layer>(id: Id<T>, data: LayerUpdate<T>): void {
    const entry = this.layers.get(id as unknown as Id<Layer>);
    if (entry === undefined) {
      throw new Error(`Unknown layer: ${id}`);
    }
    const updatedLayer = { ...entry.state$.value, ...data };
    if ('opacity' in data) {
      updatedLayer.isVisible = updatedLayer.opacity !== 0;
    } else if ('isVisible' in data) {
      if (updatedLayer.isVisible && updatedLayer.opacity === 0) {
        updatedLayer.opacity = entry.definition.opacity;
      }
    }

    (entry.controller as BaseLayerController | null)?.update(updatedLayer);
    entry.state$.next(updatedLayer);
    this.viewer.scene.requestRender();
  }

  move(id: Id<Layer>, difference: number): void {
    const ids = [...this._activeLayerIds$.value];
    const oldIndex = ids.indexOf(id);
    if (oldIndex < 0) {
      throw new Error(`Can't move inactive layer: ${id}`);
    }
    const newIndex = Math.max(0, Math.min(ids.length, oldIndex + difference));
    ids.splice(oldIndex, 1);
    ids.splice(newIndex, 0, id);

    // Reorder the Cesium layer, with the first element in the array being the topmost one.
    for (let i = ids.length - 1; i >= 0; i--) {
      this.controller(ids[i])?.moveToTop();
    }
    this._activeLayerIds$.next(ids);
  }

  private makeController(layer: Layer): LayerController {
    switch (layer.type) {
      case LayerType.Wmts:
        return new WmtsLayerController(layer, this.viewer);
      case LayerType.Tiles3d:
        return new Tiles3dLayerController(layer, this.viewer);
      case LayerType.Voxel:
      case LayerType.Tiff:
        throw new Error('nyi');
    }
  }

  private iterateGroupPath(
    groupId: Id<LayerGroup>,
    handle: (entry: GroupEntry) => void,
  ): void {
    const group = this.groups.get(groupId);
    if (group === undefined) {
      throw new Error(`Unknown group: ${groupId}`);
    }
    let lastGroup = group;
    for (;;) {
      handle(lastGroup);
      if (lastGroup.parent === null) {
        return;
      }
      lastGroup = this.groups.get(lastGroup.parent)!;
    }
  }
}

export type LayerUpdate<T = Layer> = Partial<
  Omit<T, 'type' | 'id' | 'canUpdateOpacity'>
>;

export type TreeNode =
  | { type: TreeNodeType.Group; id: Id<LayerGroup> }
  | { type: TreeNodeType.Layer; id: Id<Layer> };

export enum TreeNodeType {
  Group,
  Layer,
}

type IdArray<T> = ReadonlyArray<Id<T>>;

type IdMapping<T, V> = Map<Id<T>, V>;

interface LayerEntry {
  state$: BehaviorSubject<Layer>;
  definition: Layer;
  groups: IdArray<LayerGroup>;
  controller: LayerController | null;
}

interface GroupEntry {
  nodes: readonly TreeNode[];
  parent: Id<LayerGroup> | null;
  count: number;
}
