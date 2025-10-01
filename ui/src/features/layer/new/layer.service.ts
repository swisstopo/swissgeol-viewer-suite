import { BaseService } from 'src/utils/base.service';
import { SessionService } from 'src/features/session';
import { BehaviorSubject, map, Observable, switchMap } from 'rxjs';
import { LayerApiService } from 'src/features/layer/new/layer-api.service';
import { Id } from 'src/models/id.model';
import { Layer, LayerGroup } from 'src/features/layer';

export class LayerService extends BaseService {
  private layerApiService!: LayerApiService;

  private layerDefinitions = new Map<Id<Layer>, Layer>();

  private layers = new Map<Id<Layer>, BehaviorSubject<Layer>>();

  private layerPaths = new Map<Id<Layer>, IdArray<LayerGroup>>();

  private groups = new Map<Id<LayerGroup>, readonly TreeNode[]>();

  private groupCounts = new Map<Id<LayerGroup>, number>();

  private _rootGroupIds$ = new BehaviorSubject<IdArray<Layer>>([]);

  private _activeLayers$ = new BehaviorSubject<IdArray<Layer>>([]);

  constructor() {
    super();

    this.inject(LayerApiService).subscribe((service) => {
      this.layerApiService = service;
    });

    this.inject(SessionService)
      .pipe(
        switchMap((service) =>
          service.initialized$.pipe(switchMap(() => service.user$)),
        ),
      )
      .subscribe(() => this.loadLayers());
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
      this.layerDefinitions.set(layer.id, layer);
      this.layerPaths.set(layer.id, path);
      const previousLayer = previousLayers.get(layer.id);
      if (previousLayer === undefined) {
        this.layers.set(layer.id, new BehaviorSubject(layer));
      } else {
        previousLayers.delete(layer.id);
        this.layers.set(layer.id, previousLayer);
        previousLayer.next(layer);
      }
    };

    const insertGroup = (
      group: LayerGroup,
      path: IdArray<LayerGroup>,
    ): void => {
      const nodes: TreeNode[] = [];
      for (const node of group.children) {
        const type = insertNode(node, [...path, group.id]);
        nodes.push({ type, id: node.id } as TreeNode);
      }
      this.groups.set(group.id, nodes);
    };

    const rootGroups = await this.layerApiService.fetchLayers();
    const rootGroupIds: Array<Id<LayerGroup>> = [];

    this.layerDefinitions.clear();
    this.groups.clear();
    this.groupCounts.clear();

    const previousLayers = new Map([...this.layers]);
    this.layers.clear();

    for (const group of rootGroups) {
      rootGroupIds.push(group.id);
      insertGroup(group, []);
    }

    const activeLayers = this._activeLayers$.value.filter((it) =>
      this.layers.has(it),
    );

    for (const layer$ of previousLayers.values()) {
      layer$.complete();
    }

    this._activeLayers$.next(activeLayers);
    this._rootGroupIds$.next(rootGroupIds);
  }

  get rootGroupIds$(): Observable<ReadonlyArray<Id<LayerGroup>>> {
    return this._rootGroupIds$.asObservable();
  }

  groupCount$(id: Id<LayerGroup>): Observable<number> {
    return this.activeLayers$.pipe(map(() => this.groupCounts.get(id) ?? 0));
  }

  getNodesOfGroup(id: Id<LayerGroup>): readonly TreeNode[] {
    const nodes = this.groups.get(id);
    if (nodes === undefined) {
      throw new Error(`Unknown group: ${id}`);
    }
    return nodes;
  }

  layer$(id: Id<Layer>): Observable<Layer> {
    const layer = this.layers.get(id);
    if (layer === undefined) {
      throw new Error(`Unknown layer: ${id}`);
    }
    return layer.asObservable();
  }

  get activeLayers$(): Observable<ReadonlyArray<Id<LayerGroup>>> {
    return this._activeLayers$.asObservable();
  }

  isLayerActive(id: Id<Layer>): boolean {
    return this._activeLayers$.value.includes(id);
  }

  isLayerActive$(id: Id<Layer>): Observable<boolean> {
    return this._activeLayers$.pipe(map((layerIds) => layerIds.includes(id)));
  }

  activate(id: Id<Layer>): void {
    const activeLayers = this._activeLayers$.value;
    if (activeLayers.includes(id)) {
      return;
    }

    const layerPath = this.layerPaths.get(id)!;
    for (const groupId of layerPath) {
      const count = this.groupCounts.get(groupId) ?? 0;
      this.groupCounts.set(groupId, count + 1);
    }

    this._activeLayers$.next([id, ...activeLayers]);
  }

  deactivate(id: Id<Layer>): void {
    const activeLayers = this._activeLayers$.value;
    const i = activeLayers.indexOf(id);
    if (i < 0) {
      return;
    }

    const layerPath = this.layerPaths.get(id)!;
    for (const groupId of layerPath) {
      const count = this.groupCounts.get(groupId)!;
      if (count === 0) {
        this.groupCounts.delete(groupId);
      } else {
        this.groupCounts.set(groupId, count - 1);
      }
    }

    const updatedActiveLayers = [...activeLayers];
    updatedActiveLayers.splice(i, 1);
    this._activeLayers$.next(updatedActiveLayers);
  }

  private updateLayer(id: Id<Layer>, update: (layer: Layer) => Layer): void {
    const layer = this.layers.get(id);
    if (layer === undefined) {
      throw new Error(`Unknown layer: ${id}`);
    }
    const updatedLayer = update(layer.value);
    if (updatedLayer !== layer.value) {
      layer.next(updatedLayer);
    }
  }
}

export type TreeNode =
  | { type: TreeNodeType.Group; id: Id<LayerGroup> }
  | { type: TreeNodeType.Layer; id: Id<Layer> };

export enum TreeNodeType {
  Group,
  Layer,
}

type IdArray<T> = ReadonlyArray<Id<T>>;
