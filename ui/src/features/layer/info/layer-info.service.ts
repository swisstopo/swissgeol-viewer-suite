import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
} from 'cesium';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  Observable,
  take,
  takeUntil,
} from 'rxjs';
import i18next from 'i18next';
import { BaseService } from 'src/services/base.service';
import {
  BACKGROUND_LAYER,
  isLayerEffectivelyVisible,
  Layer,
  LayerType,
} from 'src/features/layer';
import {
  LayerInfoPicker,
  LayerPickData,
} from 'src/features/layer/info/pickers/layer-info-picker';
import { LayerInfoPickerForTiff } from 'src/features/layer/info/pickers/layer-info-picker-for-tiff';
import { LayerInfo } from 'src/features/layer/info/layer-info.model';
import { LayerService as NewLayerService } from 'src/features/layer/layer.service';
import { LayerInfoPickerForWmts } from 'src/features/layer/info/pickers/layer-info-picker-for-wmts';
import { LayerInfoPickerForVoxels } from 'src/features/layer/info/pickers/layer-info-picker-for-voxels';
import { LayerInfoPickerForTiles3d } from 'src/features/layer/info/pickers/layer-info-picker-for-tiles3d';
import DrawStore from 'src/store/draw';
import { Id } from 'src/models/id.model';
import { run, tick } from 'src/utils/fn.utils';
import { PickService } from 'src/services/pick.service';
import { LayerInfoPickerForEarthquakes } from 'src/features/layer/info/pickers/layer-info-picker-for-earthquakes';
import { CesiumService } from 'src/services/cesium.service';
import { LayerInfoPickerForGeoJson } from 'src/features/layer/info/pickers/layer-info-picker-for-geo-json';

export class LayerInfoService extends BaseService {
  private layerService!: NewLayerService;

  private pickService!: PickService;

  private readonly infosSubject = new BehaviorSubject<LayerInfo[]>([]);

  private readonly pickers: LayerInfoPicker[] = [];

  // A fresh token on each visibility transition invalidates older requests,
  // including a hide/show cycle while a service request is still pending.
  private readonly visiblePickers = new Map<LayerInfoPicker, symbol>();

  // Includes results awaiting other pickers, so their highlights are cleared
  // immediately when their layer is hidden or removed.
  private readonly ownedInfos = new Set<LayerInfo>();

  private pickRevision = 0;

  private viewer!: Viewer;

  private isPicking = false;

  private nextPick: [Cartesian2, Cartesian3] | null = null;

  constructor() {
    super();

    PickService.inject().then((pickService) => {
      this.pickService = pickService;
    });
    Promise.all([
      NewLayerService.inject(),
      CesiumService.inject().then((s) => firstValueFrom(s.viewer$)),
    ]).then(([layerService, viewer]) => {
      this.layerService = layerService;
      this.viewer = viewer;
      layerService.layerActivated$.subscribe(this.handleLayerActivated);

      const eventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
      eventHandler.setInputAction(
        (event: ScreenSpaceEventHandler.PositionedEvent) => {
          if (!DrawStore.drawStateValue) {
            this.pick2d(event.position);
          }
        },
        ScreenSpaceEventType.LEFT_CLICK,
      );
    });

    i18next.on('languageChanged', this.handleLanguageChanged);
  }

  get infos$(): Observable<readonly LayerInfo[]> {
    return this.infosSubject.asObservable();
  }

  private readonly handleLanguageChanged = (lang: string): void => {
    const infos = this.infosSubject.value;
    const revision = this.pickRevision;
    if (infos.length === 0) {
      return;
    }
    const refreshes = infos
      .filter((info) => info.refreshForLanguage != null)
      .map((info) => info.refreshForLanguage!(lang));
    if (refreshes.length === 0) {
      // Trigger re-emission so elements re-render with new translations.
      this.infosSubject.next([...infos]);
      return;
    }
    Promise.all(refreshes).then(() => {
      if (revision === this.pickRevision && this.infosSubject.value === infos) {
        this.infosSubject.next([...infos]);
      }
    });
  };

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
    this.pickRevision++;
    this.nextPick = null;
    this.destroyInfos([...this.ownedInfos]);
    this.infosSubject.next([]);
    this.viewer.canvas.style.cursor = 'default';
    this.viewer.scene.requestRender();
  }

  private destroyInfos(infos: readonly LayerInfo[]): void {
    for (const info of infos) {
      if (this.ownedInfos.delete(info)) {
        info.destroy();
      }
    }
  }

  private removeInfosForLayer(layerId: Id<Layer>): void {
    this.destroyInfos(
      [...this.ownedInfos].filter((info) => info.layerId === layerId),
    );
    const infos = this.infosSubject.value;
    const remaining = infos.filter((info) => info.layerId !== layerId);
    if (remaining.length !== infos.length) {
      this.infosSubject.next(remaining);
    }
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
        case LayerType.Tiff:
          return new LayerInfoPickerForTiff(controller, this.viewer);
        case LayerType.Earthquakes:
          return new LayerInfoPickerForEarthquakes(controller, this.viewer);
        case LayerType.GeoJson:
          return new LayerInfoPickerForGeoJson(controller, this.viewer);
        default:
          return null;
      }
    });
    if (picker === null) {
      return;
    }

    this.pickers.push(picker);
    const deactivated$ = this.layerService.layerDeactivated$.pipe(
      filter((id) => id === layerId),
      take(1),
    );
    combineLatest([
      this.layerService.layer$(layerId),
      this.layerService.layer$(BACKGROUND_LAYER.id),
    ])
      .pipe(
        map(([layer, background]) =>
          isLayerEffectivelyVisible(layer, background.isVisible),
        ),
        distinctUntilChanged(),
        takeUntil(deactivated$),
      )
      .subscribe((isVisible) => {
        if (isVisible) {
          this.visiblePickers.set(picker, Symbol());
        } else {
          this.visiblePickers.delete(picker);
          this.removeInfosForLayer(layerId);
        }
      });
    deactivated$.subscribe(() => this.removePicker(picker));
  };

  private removePicker(picker: LayerInfoPicker): void {
    const i = this.pickers.indexOf(picker);
    if (i < 0) {
      return;
    }
    this.pickers.splice(i, 1);
    this.visiblePickers.delete(picker);
    this.removeInfosForLayer(picker.layerId);
    picker.destroy();
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

    const revision = ++this.pickRevision;
    this.viewer.canvas.style.cursor = 'progress';
    this.destroyInfos([...this.ownedInfos]);
    await tick();
    if (revision !== this.pickRevision) {
      return;
    }
    const picks = [...this.visiblePickers].map(async ([picker, token]) => {
      try {
        const pickedInfos = await picker.pick(data);
        if (
          revision !== this.pickRevision ||
          this.nextPick !== null ||
          this.visiblePickers.get(picker) !== token
        ) {
          for (const info of pickedInfos) {
            info.destroy();
          }
          return [];
        }
        for (const info of pickedInfos) {
          this.ownedInfos.add(info);
        }
        return pickedInfos;
      } catch (e) {
        console.error(`Picking on ${picker.layerId} failed`, e);
        return [];
      }
    });
    const infos = (await Promise.all(picks)).flat();
    if (revision === this.pickRevision && this.nextPick === null) {
      // Visibility changes may have already destroyed some pending results.
      this.infosSubject.next(infos.filter((info) => this.ownedInfos.has(info)));
    } else {
      this.destroyInfos(infos);
    }
    if (this.nextPick === null) {
      this.viewer.canvas.style.cursor = 'default';
    }
    this.viewer.scene.requestRender();
  }
}
