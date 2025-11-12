import { BehaviorSubject, Subject } from 'rxjs';
import { Viewer } from 'cesium';
import { getCesiumToolbarParam } from '../permalink';

export default class MainStore {
  private static readonly viewerSubject = new BehaviorSubject<Viewer | null>(
    null,
  );
  private static readonly layersRemovedSubject = new Subject<void>();
  private static readonly syncMapSubject = new Subject<void>();
  private static readonly voxelLayerCountSubject = new BehaviorSubject<
    string[]
  >([]);
  static readonly syncLayerParams = new Subject<void>();

  static readonly isDebugActive$ = new BehaviorSubject(getCesiumToolbarParam());

  static get viewer(): BehaviorSubject<Viewer | null> {
    return this.viewerSubject;
  }

  static get viewerValue(): Viewer | null {
    return this.viewerSubject.getValue();
  }

  static setViewer(value: Viewer): void {
    this.viewerSubject.next(value);
  }

  static get layersRemoved() {
    return this.layersRemovedSubject;
  }

  static nextLayersRemove() {
    this.layersRemovedSubject.next();
  }

  static get syncMap() {
    return this.syncMapSubject;
  }

  static nextMapSync() {
    this.syncMapSubject.next();
  }

  static get visibleVoxelLayers() {
    return this.voxelLayerCountSubject.getValue();
  }

  static addVisibleVoxelLayer(layer) {
    const voxelLayers = this.visibleVoxelLayers;
    if (!voxelLayers.includes(layer)) {
      voxelLayers.push(layer);
      this.voxelLayerCountSubject.next(voxelLayers);
    }
  }

  static removeVisibleVoxelLayer(layer) {
    const voxelLayers = this.visibleVoxelLayers.filter((l) => l !== layer);
    this.voxelLayerCountSubject.next(voxelLayers);
  }
}
