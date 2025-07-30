import { LitElementI18n } from 'src/i18n';
import { html, PropertyValues } from 'lit';
import './elements/ngm-side-bar';
import './elements/ngm-full-screen-view';
import './elements/ngm-auth';
import './elements/ngm-nav-tools';
import './elements/ngm-cam-configuration';
import './toolbox/ngm-topo-profile-modal';
import './toolbox/ngm-geometry-info';
import './elements/ngm-layer-legend';
import './elements/ngm-voxel-filter';
import './elements/ngm-voxel-simple-filter';
import './cesium-toolbar';
import './elements/ngm-project-popup';
import './elements/ngm-coordinate-popup';
import './elements/ngm-ion-modal';
import './elements/ngm-wmts-date-picker';
import '@geoblocks/cesium-view-cube';
import './elements/ngm-map-chooser';

import 'src/features/core/core.module';
import 'src/features/background/background.module';
import 'src/features/controls/controls.module';
import 'src/features/layout/layout.module';
import 'src/features/navigation/navigation.module';

import { DEFAULT_VIEW } from './constants';

import { addMantelEllipsoid, setupViewer } from './viewer';

import {
  getCameraView,
  getCesiumToolbarParam,
  getMapParam,
  getTopicOrProject,
  getZoomToPosition,
  rewriteParams,
  syncCamera,
  syncMapOpacityParam,
  syncMapParam,
  syncStoredView,
} from './permalink';
import i18next from 'i18next';
import Slicer from './slicer/Slicer';

import { setupI18n } from './i18n.js';

import { initAnalytics } from './analytics.js';
import MainStore from './store/main';
import ToolboxStore from './store/toolbox';
import { classMap } from 'lit/directives/class-map.js';
import { customElement, query, state } from 'lit/decorators.js';
import { showSnackbarInfo } from './notifications';
import type { NgmSlowLoading } from './elements/ngm-slow-loading';
import { Event, FrameRateMonitor, Globe, ImageryLayer, Viewer } from 'cesium';
import LocalStorageController from './LocalStorageController';
import DashboardStore from './store/dashboard';
import type { SideBar } from './elements/ngm-side-bar';
import { LayerConfig, LayerTreeNode } from './layertree';
import { clientConfigContext, viewerContext } from './context';
import { consume, provide } from '@lit/context';
import { AppEnv, ClientConfig } from './api/client-config';
import { CoreModal, CoreWindow } from 'src/features/core';
import { makeId } from 'src/models/id.model';
import { BackgroundLayer } from 'src/features/layer/layer.model';
import { distinctUntilKeyChanged } from 'rxjs';
import { addSwisstopoLayer } from 'src/swisstopoImagery';
import { BackgroundLayerService } from 'src/features/background/background-layer.service';
import { TrackingConsentModalEvent } from 'src/features/layout/layout-consent-modal.element';
import { ControlsService } from 'src/features/controls/controls.service';
import { LayerService } from 'src/features/layer/layer.service';
import { LayerInfoService } from 'src/features/layer/info/layer-info.service';
import { BaseService } from 'src/utils/base.service';

const SKIP_STEP2_TIMEOUT = 5000;

const isLocalhost = document.location.hostname === 'localhost';
const shouldShowDisclaimer = !isLocalhost;

const onStep1Finished = (globe: Globe, searchParams: URLSearchParams) => {
  let sse = 2;
  if (searchParams.has('maximumScreenSpaceError')) {
    sse = parseFloat(searchParams.get('maximumScreenSpaceError')!);
  }
  globe.maximumScreenSpaceError = sse;
};

/**
 * This is the root component. It is useful for:
 * - wiring the attributes of all top-level components;
 * - distribute events vertically between components (non hierarchical).
 */
@customElement('ngm-app')
export class NgmApp extends LitElementI18n {
  @state()
  accessor slicer_: Slicer | undefined;

  @state()
  accessor showCamConfig = false;

  @state()
  accessor loading = false;

  @state()
  accessor determinateLoading = false;

  @state()
  accessor queueLength = 0;

  @state()
  accessor legendConfigs: LayerConfig[] = [];

  @state()
  accessor showProjectPopup = false;

  @state()
  accessor mobileView = false;

  @state()
  accessor showAxisOnMap = false;

  @state()
  accessor showProjectSelector = false;

  @state()
  accessor showCesiumToolbar = getCesiumToolbarParam();

  @query('ngm-cam-configuration')
  accessor camConfigElement;

  @query('ngm-voxel-filter')
  accessor voxelFilterElement;

  @query('ngm-voxel-simple-filter')
  accessor voxelSimpleFilterElement;

  @query('ngm-wmts-date-picker')
  accessor wmtsDatePickerElement;

  @consume({ context: ControlsService.context() })
  accessor controlsService!: ControlsService;

  @consume({ context: clientConfigContext })
  accessor clientConfig!: ClientConfig;

  @consume({ context: BackgroundLayerService.context() })
  accessor backgroundLayerService!: BackgroundLayerService;

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  @consume({ context: LayerInfoService.context() })
  accessor layerInfoService!: LayerInfoService;

  @provide({ context: viewerContext })
  accessor viewer: Viewer | null = null;

  @provide({ context: BackgroundLayerService.backgroundContext })
  accessor background: BackgroundLayer = null as unknown as BackgroundLayer;

  @provide({ context: LayerService.activeLayersContext })
  accessor activeLayers: readonly LayerTreeNode[] = [];

  @provide({ context: LayerService.queryableLayersContext })
  accessor queryableLayers: readonly LayerTreeNode[] = [];

  constructor() {
    super();

    this.handleTrackingAllowedChanged =
      this.handleTrackingAllowedChanged.bind(this);

    const boundingRect = document.body.getBoundingClientRect();
    this.mobileView = boundingRect.width < 600 || boundingRect.height < 630;
    window.addEventListener('resize', () => {
      const boundingRect = document.body.getBoundingClientRect();
      this.mobileView = boundingRect.width < 600 || boundingRect.height < 630;
    });
  }

  private sidebar: SideBar | null = null;
  private waitForViewLoading = false;
  private resolutionScaleRemoveCallback: Event.RemoveCallback | undefined;
  private disclaimer: CoreModal | null = null;
  private viewerRenderTimeout: number | null = null;

  private openDisclaimer(): void {
    this.disclaimer = CoreModal.open(
      { isPersistent: true, size: 'large', hasNoPadding: true },
      html`
        <ngm-layout-consent-modal
          @confirm="${this.handleTrackingAllowedChanged}"
        ></ngm-layout-consent-modal>
      `,
    );
  }

  connectedCallback(): void {
    super.connectedCallback();

    BaseService.initializeWith(this);

    this.layerService.activeLayers$.subscribe((layers) => {
      this.activeLayers = layers;
    });

    this.layerService.queryableLayers$.subscribe((layers) => {
      this.queryableLayers = layers;
    });

    let infoWindow: CoreWindow | null = null;
    this.layerInfoService.infos$.subscribe((layers) => {
      if (layers.length === 0) {
        infoWindow?.close();
        infoWindow = null;
        return;
      } else if (infoWindow !== null) {
        return;
      }

      infoWindow = CoreWindow.open({
        title: () => i18next.t('layers:infoWindow.title'),
        body: () => html`<ngm-layer-info-list></ngm-layer-info-list>`,
        onClose: () => {
          infoWindow = null;
          this.layerInfoService.reset();
        },
      });
    });

    if (shouldShowDisclaimer) {
      this.openDisclaimer();
    }
  }

  /**
   * @param {CustomEvent} evt
   */
  onLayerAdded(evt) {
    const layer = evt.detail.layer;
    if (this.slicer_ && this.slicer_!.active) {
      if (layer && layer.promise) {
        this.slicer_!.applyClippingPlanesToTileset(layer.promise);
      }
    }
  }

  onShowLayerLegend(event) {
    const config = event.detail.config;
    if (!this.legendConfigs.find((c) => c && c.layer === config.layer)) {
      this.legendConfigs.push(config);
      this.requestUpdate();
    }
  }

  onShowVoxelFilter(event: CustomEvent) {
    const config = event.detail.config;
    if (config.voxelFilter) {
      this.voxelFilterElement.config = config;
    } else {
      this.voxelSimpleFilterElement.config = config;
    }
  }

  onShowWmtsDatePicker(event: CustomEvent) {
    this.wmtsDatePickerElement.config = event.detail.config;
  }

  onCloseLayerLegend(event) {
    const config = event.target.config;
    const index = this.legendConfigs.findIndex(
      (c) => c && c.layer === config.layer,
    );
    console.assert(index !== -1);
    this.legendConfigs.splice(index, 1);
    if (!this.legendConfigs.filter((c) => !!c).length) this.legendConfigs = [];
    this.requestUpdate();
  }

  onStep2Finished(viewer) {
    if (!this.waitForViewLoading) {
      this.removeLoading();
    } else {
      const subscription = DashboardStore.viewIndex.subscribe((indx) => {
        if (typeof indx !== 'number') return;
        this.removeLoading();
        this.waitForViewLoading = false;
        subscription.unsubscribe();
      });
    }
    this.slicer_ = new Slicer(viewer);
    ToolboxStore.setSlicer(this.slicer_);

    MainStore.syncMap.subscribe(() => {
      const id = makeId<BackgroundLayer>(getMapParam());
      if (id != null) {
        this.backgroundLayerService.setBackground(id);
      }
    });

    this.sidebar = this.querySelector('ngm-side-bar') as SideBar | null;
  }

  removeLoading() {
    this.loading = false;
    (<NgmSlowLoading>this.querySelector('ngm-slow-loading')).style.display =
      'none';
  }

  /**
   * @param {import ('cesium').Viewer} viewer
   */
  startCesiumLoadingProcess(viewer) {
    const globe = viewer.scene.globe;

    addMantelEllipsoid(viewer);

    // Temporarily increasing the maximum screen space error to load low LOD tiles.
    const searchParams = new URLSearchParams(document.location.search);
    globe.maximumScreenSpaceError = parseFloat(
      searchParams.get('initialScreenSpaceError') ?? '2000',
    );

    let currentStep = 1;
    const unlisten = globe.tileLoadProgressEvent.addEventListener(
      (queueLength) => {
        this.queueLength = queueLength;
        if (currentStep === 1 && globe.tilesLoaded) {
          currentStep = 2;
          onStep1Finished(globe, searchParams);
          setTimeout(() => {
            if (currentStep === 2) {
              currentStep = 3;
              this.onStep2Finished(viewer);
              unlisten();
            }
          }, SKIP_STEP2_TIMEOUT);
        } else if (currentStep === 2 && globe.tilesLoaded) {
          currentStep = 3;
          this.onStep2Finished(viewer);
          unlisten();
        }
      },
    );
  }

  async firstUpdated() {
    setTimeout(() => (this.determinateLoading = true), 3000);
    setupI18n();
    rewriteParams();
    const cesiumContainer = this.querySelector('#cesium')!;
    const viewer = await setupViewer(
      cesiumContainer,
      this.controlsService,
      isLocalhost,
    );
    if (!this.showCesiumToolbar && !this.resolutionScaleRemoveCallback) {
      this.setResolutionScale();
    }
    this.viewer = viewer;
    window['viewer'] = viewer; // for debugging

    this.startCesiumLoadingProcess(viewer);
    const topicOrProjectParam = getTopicOrProject();
    if (topicOrProjectParam) {
      this.waitForViewLoading = !!topicOrProjectParam.param.viewId;
      !this.waitForViewLoading &&
        (<SideBar>this.querySelector('ngm-side-bar')).togglePanel('dashboard');
      DashboardStore.setTopicOrProjectParam(topicOrProjectParam);
    } else {
      const storedView = LocalStorageController.storedView;
      if (storedView) {
        syncStoredView(storedView);
        LocalStorageController.removeStoredView();
      }
    }

    viewer.camera.moveEnd.addEventListener(() => syncCamera(viewer.camera));
    const { destination, orientation } = getCameraView();
    const zoomToPosition = getZoomToPosition();
    if (!zoomToPosition) {
      viewer.camera.flyTo({
        destination: destination || DEFAULT_VIEW.destination,
        orientation: orientation || DEFAULT_VIEW.orientation,
        duration: 0,
        complete: () => {
          const { destination, orientation } = getCameraView();
          if (!destination || !orientation) {
            syncCamera(viewer.camera);
          }
        },
      });
    }

    MainStore.setViewer(viewer);

    i18next.on('initialized', () => {
      this.showSlowLoadingWindow();
    });

    const origin = window.location.origin;
    const pathname = window.location.pathname;
    (<any>this.querySelector('#ngm-home-link')).href = `${origin}${pathname}`;

    window.addEventListener('resize', () => {
      (<any>this.querySelectorAll('.ngm-floating-window')).forEach((flWin) => {
        if (flWin.interaction) {
          flWin.interaction.reflow({ name: 'drag', axis: 'xy' });
        }
      });
    });

    this.initializeBackgroundLayers();
  }

  private initializeBackgroundLayers(): void {
    this.backgroundLayerService.background$.subscribe(async (background) => {
      this.background = background;
      await import('src/features/layer/layer.module');
    });

    let activeLayers: ImageryLayer[] = [];
    this.backgroundLayerService.background$
      .pipe(distinctUntilKeyChanged('children'))
      .subscribe((background) => {
        activeLayers.forEach((layer) =>
          this.viewer!.scene.imageryLayers.remove(layer),
        );
        activeLayers = [];
        const readyPromises = [] as Array<Promise<void>>;
        for (const sublayer of background.children) {
          const layer = addSwisstopoLayer(
            this.viewer!,
            sublayer.id as string,
            sublayer.format,
            sublayer.maximumLevel,
          );
          layer.show = true;
          readyPromises.push(
            new Promise<void>((resolve) => {
              layer.readyEvent.addEventListener(() => {
                resolve();
              });
            }),
          );
          activeLayers.push(layer);
        }
        this.updateBaseMapTranslucency(
          background.opacity,
          background.hasAlphaChannel,
        );
        syncMapParam(background.id);
        Promise.all(readyPromises).then(() => this.requestViewerRender());
      });

    let opacityTimeout: number | null = null;
    this.backgroundLayerService.background$
      .pipe(distinctUntilKeyChanged('opacity'))
      .subscribe((background) => {
        if (opacityTimeout !== null) {
          clearTimeout(opacityTimeout);
        }
        opacityTimeout = setTimeout(() => {
          opacityTimeout = null;
          syncMapOpacityParam(background.opacity);
        }, 50) as unknown as number;

        this.updateBaseMapTranslucency(
          background.opacity,
          background.hasAlphaChannel,
        );
        this.requestViewerRender();
      });

    this.backgroundLayerService.background$
      .pipe(distinctUntilKeyChanged('isVisible'))
      .subscribe((background) => {
        if (background.isVisible) {
          this.updateBaseMapTranslucency(
            background.opacity,
            background.hasAlphaChannel,
          );
          syncMapParam(background.id);
        } else {
          this.updateBaseMapTranslucency(0, background.hasAlphaChannel);
          syncMapParam('empty_map');
        }
        this.requestViewerRender();
      });
  }

  private requestViewerRender(): void {
    if (this.viewerRenderTimeout != null) {
      return;
    }
    this.viewerRenderTimeout = setTimeout(() => {
      this.viewerRenderTimeout = null;
      this.viewer!.scene.requestRender();
    }) as unknown as number;
  }

  protected updated(changedProperties: PropertyValues) {
    if (changedProperties.has('showCamConfig')) {
      if (this.showCamConfig) {
        (<HTMLElement>(
          document.querySelector('.ngm-cam-lock-info')
        ))?.parentElement?.remove();
      } else if (this.camConfigElement.lockType) {
        let message = '';
        switch (this.camConfigElement.lockType) {
          case 'angle':
            message = i18next.t('cam_lock_info_angle');
            break;
          case 'elevation':
            message = i18next.t('cam_lock_info_elevation');
            break;
          case 'move':
            message = i18next.t('cam_lock_info_move');
            break;
          case 'pitch':
            message = i18next.t('cam_lock_info_pitch');
            break;
        }
        showSnackbarInfo(message, {
          displayTime: 0,
          class: 'ngm-cam-lock-info',
          actions: [
            {
              text: i18next.t('app_cancel_btn_label'),
              click: () => this.camConfigElement.disableLock(),
            },
          ],
        });
        // closeOnClick doesn't work with actions
        document
          .querySelector('.ngm-cam-lock-info .close.icon')
          ?.addEventListener('click', () => {
            (<HTMLElement>(
              document.querySelector('.ngm-cam-lock-info')
            ))?.parentElement?.remove();
          });
      }
    }

    if (changedProperties.has('showCesiumToolbar')) {
      if (!this.showCesiumToolbar && !this.resolutionScaleRemoveCallback) {
        this.setResolutionScale();
      } else if (this.showCesiumToolbar && this.resolutionScaleRemoveCallback) {
        this.resolutionScaleRemoveCallback();
        this.resolutionScaleRemoveCallback = undefined;
      }
    }
    super.updated(changedProperties);
  }

  private updateBaseMapTranslucency(
    opacity: number,
    hasAlphaChannel: boolean,
  ): void {
    const { translucency } = this.viewer!.scene.globe;
    translucency.frontFaceAlpha = opacity;
    if (opacity === 1) {
      translucency.enabled = hasAlphaChannel;
      translucency.backFaceAlpha = 1;
    } else {
      translucency.backFaceAlpha = 0;
      translucency.enabled = true;
    }
  }

  showSlowLoadingWindow() {
    const timeout = 10000;
    if (this.loading && performance.now() > timeout) {
      (<NgmSlowLoading>this.querySelector('ngm-slow-loading'))!.style.display =
        'block';
    } else {
      setTimeout(() => {
        if (this.loading) {
          (<NgmSlowLoading>(
            this.querySelector('ngm-slow-loading')
          ))!.style.display = 'block';
        }
      }, timeout - performance.now());
    }
  }

  setResolutionScale() {
    if (!this.viewer) return;
    const viewer = this.viewer;
    const frameRateMonitor = FrameRateMonitor.fromScene(viewer.scene);
    const scaleDownFps = 20;
    const scaleUpFps = 30;
    this.resolutionScaleRemoveCallback =
      viewer.scene.postRender.addEventListener(() => {
        if (
          frameRateMonitor.lastFramesPerSecond < scaleDownFps &&
          viewer.resolutionScale > 0.45
        ) {
          viewer.resolutionScale = Number(
            (viewer.resolutionScale - 0.05).toFixed(2),
          );
        } else if (
          frameRateMonitor.lastFramesPerSecond > scaleUpFps &&
          viewer.resolutionScale < 1
        ) {
          viewer.resolutionScale = Number(
            (viewer.resolutionScale + 0.05).toFixed(2),
          );
        }
      });
  }

  handleTrackingAllowedChanged(event: TrackingConsentModalEvent) {
    this.disclaimer?.close();
    this.disclaimer = null;
    this.showNavigationHint();

    if (this.clientConfig.env === AppEnv.Prod) {
      initAnalytics(event.detail.isAllowed);
    }
  }

  showNavigationHint() {
    const ctrlHandler = (evt) => {
      if (evt.key === 'Control') {
        (<HTMLElement | null>document.querySelector('.ngm-nav-hint'))?.click();
      }
    };
    showSnackbarInfo(i18next.t('navigation_hint'), {
      class: 'ngm-nav-hint',
      displayTime: 20000,
      onHidden: () => document.removeEventListener('keydown', ctrlHandler),
    });
    document.addEventListener('keydown', ctrlHandler);
  }

  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <layout-env-ribbon></layout-env-ribbon>
      <header>
        <div class="left">
          <a id="ngm-home-link" href="">
            <img
              class="hidden-mobile"
              src="/images/swissgeol_viewer.svg"
              height="36"
            />
            <img
              class="visible-mobile"
              src="/images/swissgeol_favicon_viewer.svg"
            />
            <div class="logo-text visible-mobile">swissgeol</div>
          </a>
          <ngm-navigation-search
            .viewer="${this.viewer}"
            .sidebar="${this.sidebar}"
          ></ngm-navigation-search>
        </div>
        <ngm-layout-header-actions></ngm-layout-header-actions>
      </header>
      <main>
        <div
          class="ui dimmer ngm-main-load-dimmer ${classMap({
            active: this.loading,
          })}"
        >
          <div ?hidden=${!this.loading} class="ngm-determinate-loader">
            <div
              class="ui inline mini loader ${classMap({
                active: this.loading,
                determinate: this.determinateLoading,
              })}"
            ></div>
            <span ?hidden=${!this.determinateLoading} class="ngm-load-counter"
              >${this.queueLength}</span
            >
          </div>
        </div>
        <ngm-side-bar
          .mobileView=${this.mobileView}
          @layeradded=${this.onLayerAdded}
          @showLayerLegend=${this.onShowLayerLegend}
          @showVoxelFilter=${this.onShowVoxelFilter}
          @showWmtsDatePicker=${this.onShowWmtsDatePicker}
          @toggleDebugTools=${(evt) => {
            this.showCesiumToolbar = evt.detail.active;
          }}
        >
        </ngm-side-bar>
        <div class="map" oncontextmenu="return false;">
          <div id="cesium">
            <ngm-slow-loading style="display: none;"></ngm-slow-loading>
            <ngm-geometry-info class="ngm-floating-window"></ngm-geometry-info>
            <ngm-topo-profile-modal
              class="ngm-floating-window"
            ></ngm-topo-profile-modal>
            <ngm-nav-tools
              class="ngm-floating-window"
              .showCamConfig=${this.showCamConfig}
              @togglecamconfig=${() =>
                (this.showCamConfig = !this.showCamConfig)}
              @axisstate=${(evt) => (this.showAxisOnMap = evt.detail.showAxis)}
            >
            </ngm-nav-tools>
            <ngm-cam-configuration
              class="ngm-floating-window"
              .hidden=${!this.showCamConfig}
              .viewer=${this.viewer}
              @close=${() => (this.showCamConfig = false)}
            >
            </ngm-cam-configuration>
            <ngm-project-popup
              class="ngm-floating-window ${classMap({
                compact: this.mobileView,
              })}"
              .hidden=${!this.showProjectPopup}
              @close=${() => (this.showProjectPopup = false)}
            >
            </ngm-project-popup>
            ${[...this.legendConfigs].map((config) =>
              config
                ? html`
                    <ngm-layer-legend
                      class="ngm-floating-window"
                      .config=${config}
                      @close=${this.onCloseLayerLegend}
                    ></ngm-layer-legend>
                  `
                : '',
            )}
            <ngm-voxel-filter
              class="ngm-floating-window"
              .viewer=${this.viewer}
              hidden
            ></ngm-voxel-filter>
            <ngm-voxel-simple-filter
              class="ngm-floating-window"
              .viewer=${this.viewer}
              hidden
            ></ngm-voxel-simple-filter>
            <ngm-coordinate-popup
              class="ngm-floating-window"
            ></ngm-coordinate-popup>
            <ngm-wmts-date-picker
              class="ngm-floating-window"
            ></ngm-wmts-date-picker>
            <div class="on-map-menu">
              <cesium-view-cube
                ?hidden=${this.mobileView || this.showAxisOnMap}
                .scene="${this.viewer?.scene}"
              ></cesium-view-cube>

              <ngm-map-chooser
                .hidden=${this.mobileView}
                class="ngm-bg-chooser-map"
                .initiallyOpened=${false}
              ></ngm-map-chooser>
            </div>
          </div>
          ${this.showCesiumToolbar
            ? html` <cesium-toolbar></cesium-toolbar>`
            : ''}
        </div>
      </main>
    `;
  }
}
