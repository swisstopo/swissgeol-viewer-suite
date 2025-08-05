import { BaseService } from 'src/utils/base.service';
import { createContext } from '@lit/context';
import { LayerTreeNode } from 'src/layertree';
import { BehaviorSubject, map, Observable } from 'rxjs';

export class LayerService extends BaseService {
  static readonly activeLayersContext = createContext<readonly LayerTreeNode[]>(
    'LayerService.activeLayers',
  );

  static readonly queryableLayersContext = createContext<
    readonly LayerTreeNode[]
  >('LayerService.queryableLayers');

  private readonly layersSubject = new BehaviorSubject<
    readonly LayerTreeNode[]
  >([]);

  private readonly queryableLayersObservable = this.layersSubject.pipe(
    map((layers) => layers.filter((layer) => layer.visible && !layer.noQuery)),
  );

  get activeLayers(): readonly LayerTreeNode[] {
    return this.layersSubject.value;
  }

  get activeLayers$(): Observable<readonly LayerTreeNode[]> {
    return this.layersSubject.asObservable();
  }

  get queryableLayers$(): Observable<readonly LayerTreeNode[]> {
    return this.queryableLayersObservable;
  }

  set(layers: readonly LayerTreeNode[]): void {
    this.layersSubject.next(layers);
  }

  activate(layer: LayerTreeNode): void {
    this.layersSubject.next([...this.layersSubject.value, layer]);
  }

  deactivate(layer: LayerTreeNode): void {
    const layers = [...this.layersSubject.value];
    const i = layers.findIndex((it) => isSameLayer(layer, it));
    if (i >= 0) {
      layers.splice(i, 1);
      this.layersSubject.next(layers);
    }
  }
}

export const isSameLayer = (a: LayerTreeNode, b: LayerTreeNode): boolean =>
  a === b || a.label === b.label;
