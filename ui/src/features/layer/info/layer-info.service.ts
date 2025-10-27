import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  ImageryLayer,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
} from 'cesium';
import {
  BehaviorSubject,
  delay,
  filter,
  Observable,
  Subject,
  take,
} from 'rxjs';
import { BaseService } from 'src/utils/base.service';
import MainStore from 'src/store/main';
import {
  isLayerTiffImagery,
  Layer,
  LayerTiffController,
  LayerType,
} from 'src/features/layer';
import {
  LayerInfoPicker,
  LayerPickData,
} from 'src/features/layer/info/pickers/layer-info-picker';
import { LayerInfoPickerForTiff } from 'src/features/layer/info/pickers/layer-info-picker-for-tiff';
import {
  LayerInfo,
  LayerInfoSource,
} from 'src/features/layer/info/layer-info.model';
import { isSameLayer } from 'src/features/layer/layer.service';
import { LayerService as NewLayerService } from 'src/features/layer/new/layer.service';
import { LayerTreeNode } from 'src/layertree';
import { LayerInfoPickerForWmts } from 'src/features/layer/info/pickers/layer-info-picker-for-wmts';
import { LayerInfoPickerForVoxels } from 'src/features/layer/info/pickers/layer-info-picker-for-voxels';
import { LayerInfoPickerForTiles3d } from 'src/features/layer/info/pickers/layer-info-picker-for-tiles3d';
import DrawStore from 'src/store/draw';
import { Id } from 'src/models/id.model';
import { run, tick } from 'src/utils/fn.utils';
import { PickService } from 'src/services/pick.service';

export class LayerInfoService extends BaseService {
  private layerService!: NewLayerService;

  private pickService!: PickService;

  private readonly infosSubject = new BehaviorSubject<LayerInfo[]>([]);

  private readonly pickers: LayerInfoPicker[] = [];

  private viewer!: Viewer;

  private isPicking = false;

  private nextPick: [Cartesian2, Cartesian3] | null = null;

  /**
   * A set of modifications to the current sources.
   * These are delayed so short-term additions/removals don't affect the view.
   * @private
   */
  private queuedModifications: Modification[] = [];

  /**
   * A subject that emits whenever a new modification is queued.
   * @private
   */
  private readonly modificationSubject = new Subject<void>();

  constructor() {
    super();

    PickService.inject().then((pickService) => {
      this.pickService = pickService;
    });

    NewLayerService.inject().then((layerService) => {
      this.layerService = layerService;
      layerService.layerActivated$.subscribe(this.handleLayerActivated);
    });

    MainStore.viewer.subscribe((viewer) => {
      if (viewer === null) {
        return;
      }
      this.viewer = viewer;
      this.initializeImageryLayers();

      const eventHandler = new ScreenSpaceEventHandler(viewer.canvas);
      eventHandler.setInputAction(
        async (event: ScreenSpaceEventHandler.PositionedEvent) => {
          if (DrawStore.drawStateValue) {
            return;
          }
          this.pick2d(event.position);
        },
        ScreenSpaceEventType.LEFT_CLICK,
      );
    });

    this.modificationSubject.pipe(delay(200)).subscribe(() => {
      let modifications = this.queuedModifications;
      this.queuedModifications = [];
      while (modifications.length > 0) {
        const modification = modifications.pop()!;
        modifications = modifications.filter(
          (it) => !isSameSource(it.source, modification.source),
        );
        modification.action();
      }
    });
  }

  get infos$(): Observable<readonly LayerInfo[]> {
    return this.infosSubject.asObservable();
  }

  pick2d(position: Cartesian2): void {
    const cartesian = this.pickService.pick(position);
    if (cartesian !== null) {
      this.pick3d(position, cartesian);
    }
  }

  pick3d(windowPosition: Cartesian2, globePosition: Cartesian3): void {
    if (this.isPicking) {
      this.nextPick = [windowPosition, globePosition];
      return;
    }
    this.isPicking = true;
    this.handlePick(windowPosition, globePosition).finally(() => {
      this.isPicking = false;
      if (this.nextPick !== null) {
        const pick = this.nextPick;
        this.nextPick = null;
        this.pick3d(...pick);
      }
    });
  }

  reset(): void {
    for (const info of this.infosSubject.value) {
      info.destroy();
    }
    this.infosSubject.next([]);
    this.viewer.scene.requestRender();
  }

  private readonly handleLayerActivated = (layerId: Id<Layer>): void => {
    const controller = this.layerService.controller(layerId)!;
    const picker = run(() => {
      switch (controller.type) {
        case LayerType.Wmts:
          return new LayerInfoPickerForWmts(controller, this.viewer);
        case LayerType.Tiles3d:
          return new LayerInfoPickerForTiles3d(controller, this.viewer);
        case LayerType.Voxel:
          return new LayerInfoPickerForVoxels(controller, this.viewer);
      }
    });

    this.pickers.push(picker);
    this.layerService.layerDeactivated$
      .pipe(
        filter((id) => id === layerId),
        take(1),
      )
      .subscribe(() => this.removePicker(picker));
  };

  private removePicker(picker: LayerInfoPicker): void {
    const i = this.pickers.findIndex((it) => it === picker);
    if (i < 0) {
      return;
    }
    this.pickers.splice(i, 1);
    const newInfos = this.infosSubject.value.reduce((infos, info) => {
      if (info.source === picker.source) {
        info.destroy();
      } else {
        infos.push(info);
      }
      return infos;
    }, [] as LayerInfo[]);
    this.infosSubject.next(newInfos);
    picker.destroy();
    this.viewer.scene.requestRender();
  }

  private async handlePick(
    windowPosition: Cartesian2,
    cartesian: Cartesian3,
  ): Promise<void> {
    const data: LayerPickData = {
      windowPosition,
      globePosition: {
        cartesian,
        cartographic: Cartographic.fromCartesian(cartesian),
      },
      distance: Cartesian3.distance(
        this.viewer.scene.camera.positionWC,
        cartesian,
      ),
    };

    this.viewer.canvas.style.cursor = 'progress';
    await tick();
    const infos: LayerInfo[] = [];
    const picks = this.pickers.map(async (picker) => {
      const pickedInfos = await picker.pick(data);
      infos.push(...pickedInfos);
    });
    for (const info of this.infosSubject.value) {
      info.destroy();
    }
    await Promise.all(picks);
    if (this.nextPick === null) {
      // If there is no next pick queued up, we can display the results.
      this.infosSubject.next(infos);
      this.viewer.canvas.style.cursor = 'default';
      this.viewer.scene.requestRender();
    } else {
      // If there is already a new pick queued, we simply destroy our results.
      // Without this, the results would be visibly for a short second and then be removed either way.
      for (const info of infos) {
        info.destroy();
      }
    }
  }

  private initializeImageryLayers(): void {
    const layers = this.viewer.scene.imageryLayers;
    for (let i = 0; i < layers.length; i++) {
      this.handleImageryLayerAddition(layers.get(i));
    }
    layers.layerAdded.addEventListener(this.handleImageryLayerAddition);
    layers.layerRemoved.addEventListener(this.handleImageryLayerRemoval);
  }

  private readonly handleImageryLayerAddition = (layer: ImageryLayer): void => {
    if (!isLayerTiffImagery(layer)) {
      return;
    }
    this.queueModification({
      source: layer.controller,
      action: () => {
        this.addPicker(
          new LayerInfoPickerForTiff(this.viewer, layer.controller),
        );
      },
    });
  };

  private readonly handleImageryLayerRemoval = (layer: ImageryLayer): void => {
    if (!isLayerTiffImagery(layer)) {
      return;
    }
    this.queueModification({
      source: layer.controller,
      action: () => this.removePickerBySource(layer.controller),
    });
  };

  private addPicker(picker: LayerInfoPicker): void {
    const i = this.pickers.findIndex((info) =>
      isSameSource(picker.source, info.source),
    );
    if (i >= 0) {
      return;
    }
    this.pickers.push(picker);
  }

  private removePickerBySource(source: LayerInfoSource): void {
    const i = this.pickers.findIndex((info) =>
      isSameSource(source, info.source),
    );
    if (i >= 0) {
      const [picker] = this.pickers.splice(i, 1);
      const newInfos = this.infosSubject.value.reduce((infos, info) => {
        if (isSameSource(source, info.source)) {
          info.destroy();
        } else {
          infos.push(info);
        }
        return infos;
      }, [] as LayerInfo[]);
      this.infosSubject.next(newInfos);
      picker.destroy();
      this.viewer.scene.requestRender();
    }
  }

  private queueModification(modification: Modification): void {
    this.queuedModifications.push(modification);
    this.modificationSubject.next();
  }
}

const isSameSource = (a: LayerInfoSource, b: LayerInfoSource): boolean => {
  if (a === b) {
    return true;
  }
  if (a instanceof LayerTiffController || b instanceof LayerTiffController) {
    return false;
  }
  if (typeof a === 'string' || typeof b === 'string') {
    return false;
  }
  return isSameLayer(a as LayerTreeNode, b as LayerTreeNode);
};

interface Modification {
  source: LayerInfoSource;
  action: () => void;
}
