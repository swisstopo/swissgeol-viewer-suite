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
  Observable,
  Subject,
  withLatestFrom,
} from 'rxjs';
import { BaseService } from 'src/utils/base.service';
import MainStore from 'src/store/main';
import { isLayerTiffImagery, LayerTiffController } from 'src/features/layer';
import {
  LayerInfoPicker,
  LayerPickData,
} from 'src/features/layer/info/pickers/layer-info-picker';
import { LayerInfoPickerForTiff } from 'src/features/layer/info/pickers/layer-info-picker-for-tiff';
import {
  LayerInfo,
  LayerInfoSource,
} from 'src/features/layer/info/layer-info.model';
import { isSameLayer, LayerService } from 'src/features/layer/layer.service';
import { LayerTreeNode } from 'src/layertree';
import { LayerInfoPickerForGeoadmin } from 'src/features/layer/info/pickers/layer-info-picker-for-geoadmin';

export class LayerInfoService extends BaseService {
  private readonly infosSubject = new BehaviorSubject<LayerInfo[]>([]);

  private readonly pickers: LayerInfoPicker[] = [];

  private viewer!: Viewer;

  private isPicking = false;

  private nextPick: Cartesian3 | null = null;

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

    MainStore.viewer
      .pipe(withLatestFrom(this.inject(LayerService)))
      .subscribe(([viewer, layerService]) => {
        if (viewer === null) {
          return;
        }
        this.viewer = viewer;
        this.initializeImageryLayers();
        this.initializeQueryableLayers(layerService);

        const eventHandler = new ScreenSpaceEventHandler(viewer.canvas);
        eventHandler.setInputAction(
          async (event: ScreenSpaceEventHandler.PositionedEvent) => {
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
    const cartesian = this.viewer.scene.pickPosition(position);
    if (cartesian) {
      this.pick3d(cartesian);
    }
  }

  pick3d(cartesian: Cartesian3): void {
    if (this.isPicking) {
      this.nextPick = cartesian;
      return;
    }
    this.isPicking = true;
    this.handlePick(cartesian).finally(() => {
      this.isPicking = false;
      if (this.nextPick !== null) {
        const pick = this.nextPick;
        this.nextPick = null;
        this.pick3d(pick);
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

  private async handlePick(cartesian: Cartesian3): Promise<void> {
    const data: LayerPickData = {
      cartesian,
      cartographic: Cartographic.fromCartesian(cartesian),
      distance: Cartesian3.distance(
        this.viewer.scene.camera.positionWC,
        cartesian,
      ),
    };

    this.viewer.canvas.style.cursor = 'progress';
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

  private initializeQueryableLayers(layerService: LayerService): void {
    // The queryable layers that are currently being handled.
    let currentLayers: readonly LayerTreeNode[] = [];

    // Handle updates to the queryable layers.
    layerService.queryableLayers$.subscribe((newLayers) => {
      // An array containing all previously handled layers.
      // This will be cut down to only contain the removed layers.
      const oldLayers = [...currentLayers];

      // Update the handled layers.
      currentLayers = newLayers;

      // Iterate the new layers to compare them with the previously handled ones.
      for (const newLayer of newLayers) {
        // Check if we are already handling this layer.
        const oldLayerIndex = oldLayers.findIndex((it) =>
          isSameLayer(newLayer, it),
        );
        if (oldLayerIndex < 0) {
          // If we are not already handling the layer, we create a new picker for it.
          this.handleQueryableLayerAddition(newLayer);
        } else {
          // If we are already handling the layer, we remove it from the `oldLayers` array.
          // This way, only the removed layers will remain in that array.
          oldLayers.splice(oldLayerIndex, 1);
        }
      }

      // Remove the pickers of any layers that do not exist anymore.
      for (const oldLayer of oldLayers) {
        this.handleQueryableLayerRemoval(oldLayer);
      }
    });
  }

  private readonly handleQueryableLayerAddition = (
    layer: LayerTreeNode,
  ): void => {
    this.queueModification({
      source: layer,
      action: () =>
        this.pickers.unshift(
          new LayerInfoPickerForGeoadmin(layer, this.viewer),
        ),
    });
  };

  private readonly handleQueryableLayerRemoval = (
    layer: LayerTreeNode,
  ): void => {
    this.queueModification({
      source: layer,
      action: () => this.removePickerBySource(layer),
    });
  };

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
  if (a instanceof LayerTiffController || b instanceof LayerTiffController) {
    return a === b;
  }
  return isSameLayer(a, b);
};

interface Modification {
  source: LayerInfoSource;
  action: () => void;
}
