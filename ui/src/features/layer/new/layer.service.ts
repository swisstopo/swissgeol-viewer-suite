import { BaseService } from 'src/utils/base.service';
import { SessionService } from 'src/features/session';
import { BehaviorSubject, map, Observable, switchMap } from 'rxjs';
import { LayerApiService } from 'src/features/layer/new/layer-api.service';
import { Id } from 'src/models/id.model';
import {
  Layer,
  LayerGroup,
  LayerType,
  SwisstopoLayer,
} from 'src/features/layer';
import { WmtsService } from 'src/services/wmts.service';
import { LayerController } from 'src/features/layer/new/controller/layer.controller';
import { SwisstopoLayerController } from 'src/features/layer/new/controller/layer-swisstopo.controller';
import { Viewer } from 'cesium';
import MainStore from 'src/store/main';

export class LayerService extends BaseService {
  private viewer!: Viewer;

  private layerApiService!: LayerApiService;

  private layers: IdMapping<Layer, LayerEntry> = new Map();

  private groups: IdMapping<LayerGroup, GroupEntry> = new Map();

  private _rootGroupIds$ = new BehaviorSubject<IdArray<Layer>>([]);

  private _activeLayerIds$ = new BehaviorSubject<IdArray<Layer>>([]);

  constructor() {
    super();

    MainStore.viewer.subscribe((viewer) => {
      if (viewer !== null) {
        this.viewer = viewer;
      }
    });

    LayerApiService.inject().subscribe((service) => {
      this.layerApiService = service;
    });

    SessionService.inject()
      .pipe(
        switchMap((service) =>
          service.initialized$.pipe(switchMap(() => service.user$)),
        ),
      )
      .subscribe(() => this.loadLayers());

    WmtsService.inject()
      .pipe(switchMap((wmtsService) => wmtsService.layers$))
      .subscribe((layers) => this.syncWmtsLayers(layers));
  }

  private syncWmtsLayers(layers: SwisstopoLayer[]) {
    for (const layer of layers) {
      const entry = this.layers.get(layer.id);
      if (entry === undefined) {
        continue;
      }
      const fields = {
        format: layer.format,
        credit: layer.credit,
        dimension: layer.dimension,
      } satisfies Partial<SwisstopoLayer>;

      const updatedState: SwisstopoLayer = {
        ...(entry.state$.value as SwisstopoLayer),
        ...fields,
      };

      const updatedDefinition: SwisstopoLayer = {
        ...(entry.definition as SwisstopoLayer),
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
    const insertNode = (
      node: Layer | LayerGroup,
      path: IdArray<LayerGroup>,
    ): TreeNodeType => {
      if ('type' in node) {
        insertLayer(node, path);
        return TreeNodeType.Layer;
      } else {
        insertGroup(node, path);
        return TreeNodeType.Group;
      }
    };

    const insertLayer = (layer: Layer, path: IdArray<LayerGroup>): void => {
      const previousLayer = previousLayers.get(layer.id);
      const entry = {
        definition: layer,
        path,
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
        updated.controller?.update(layer);
        updated.state$.next(layer);
      }
    };

    const insertGroup = (
      group: LayerGroup,
      path: IdArray<LayerGroup>,
    ): void => {
      const nodes: TreeNode[] = [];
      let count = 0;
      for (const node of group.children) {
        const type = insertNode(node, [...path, group.id]);
        nodes.push({ type, id: node.id } as TreeNode);
        switch (type) {
          case TreeNodeType.Group:
            count += this.groups.get(node.id)!.count;
            break;
          case TreeNodeType.Layer:
            if (this._activeLayerIds$.value.includes(node.id)) {
              count += 1;
            }
            break;
        }
      }
      this.groups.set(group.id, { count, nodes });
    };

    const rootGroups = await this.layerApiService.fetchLayers();
    const rootGroupIds: Array<Id<LayerGroup>> = [];

    this.groups.clear();

    const previousLayers = new Map([...this.layers]);
    this.layers.clear();

    for (const group of rootGroups) {
      rootGroupIds.push(group.id);
      insertGroup(group, []);
    }

    const activeLayers = this._activeLayerIds$.value.filter((it) =>
      this.layers.has(it),
    );

    for (const entry of previousLayers.values()) {
      entry.state$.complete();
    }

    this._activeLayerIds$.next(activeLayers);
    this._rootGroupIds$.next(rootGroupIds);
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

  layer$(id: Id<Layer>): Observable<Layer> {
    const entry = this.layers.get(id);
    if (entry === undefined) {
      throw new Error(`Unknown layer: ${id}`);
    }
    return entry.state$.asObservable();
  }

  get activeLayerIds$(): Observable<ReadonlyArray<Id<LayerGroup>>> {
    return this._activeLayerIds$.asObservable();
  }

  isLayerActive(id: Id<Layer>): boolean {
    return this._activeLayerIds$.value.includes(id);
  }

  isLayerActive$(id: Id<Layer>): Observable<boolean> {
    return this._activeLayerIds$.pipe(map((layerIds) => layerIds.includes(id)));
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
    for (const groupId of entry.path) {
      const group = this.groups.get(groupId)!;
      group.count += 1;
    }
    entry.controller = this.makeController(entry.state$.value);
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
    for (const groupId of entry.path) {
      const group = this.groups.get(groupId)!;
      group.count -= 1;
    }

    entry.controller!.remove();
    entry.controller = null;

    const updatedActiveLayers = [...activeLayers];
    updatedActiveLayers.splice(i, 1);
    this._activeLayerIds$.next(updatedActiveLayers);
    this.viewer.scene.requestRender();
  }

  update(id: Id<Layer>, data: Partial<LayerUpdate>): void {
    const entry = this.layers.get(id);
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

    entry.controller?.update(updatedLayer);
    entry.state$.next(updatedLayer);
    this.viewer.scene.requestRender();
  }

  private makeController(layer: Layer): LayerController {
    switch (layer.type) {
      case LayerType.Swisstopo:
        return new SwisstopoLayerController(layer, this.viewer);
      case LayerType.Tiles3d:
      case LayerType.Background:
      case LayerType.Voxel:
      case LayerType.Tiff:
        throw new Error('nyi');
    }
  }
}

export type LayerUpdate = Omit<Layer, 'type' | 'id' | 'canUpdateOpacity'>;

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
  path: IdArray<LayerGroup>;
  controller: LayerController | null;
}

interface GroupEntry {
  nodes: readonly TreeNode[];
  count: number;
}
