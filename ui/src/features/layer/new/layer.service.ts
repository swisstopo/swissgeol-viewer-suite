import { BaseService } from 'src/utils/base.service';
import { SessionService } from 'src/features/session';
import { BehaviorSubject, map, Observable, switchMap } from 'rxjs';
import {
  LayerApiService,
  LayerGroupConfig,
} from 'src/features/layer/new/layer-api.service';
import { Id } from 'src/models/id.model';
import { Layer, LayerGroup, SwisstopoLayer } from 'src/features/layer';
import { WmtsService } from 'src/services/wmts.service';
import { Viewer } from 'cesium';
import MainStore from 'src/store/main';

export class LayerService extends BaseService {
  private viewer!: Viewer;

  private layerApiService!: LayerApiService;

  private readonly layers: IdMapping<Layer, LayerEntry> = new Map();

  private readonly groups: IdMapping<LayerGroup, GroupEntry> = new Map();

  private readonly _rootGroupIds$ = new BehaviorSubject<IdArray<Layer>>([]);

  private readonly _activeLayerIds$ = new BehaviorSubject<IdArray<Layer>>([]);

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
    const insertLayer = (layer: Layer): void => {
      const previousLayer = previousLayers.get(layer.id);
      const entry = {
        definition: layer,
        groups: [],
      } satisfies Partial<LayerEntry>;
      if (previousLayer === undefined) {
        this.layers.set(layer.id, {
          ...entry,
          state$: new BehaviorSubject(layer),
        });
      } else {
        previousLayers.delete(layer.id);
        const updated: LayerEntry = {
          ...entry,
          state$: previousLayer.state$,
        };
        this.layers.set(layer.id, updated);
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

    const previousLayers = new Map(this.layers);
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

    // Reset the state after removal.
    entry.state$.next(entry.definition);

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

    entry.state$.next(updatedLayer);
    this.viewer.scene.requestRender();
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
  groups: IdArray<LayerGroup>;
}

interface GroupEntry {
  nodes: readonly TreeNode[];
  parent: Id<LayerGroup> | null;
  count: number;
}
