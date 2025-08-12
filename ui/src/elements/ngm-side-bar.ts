import { html } from 'lit';
import { LitElementI18n } from 'src/i18n';
import 'src/toolbox/ngm-toolbox';
import 'src/elements/dashboard/ngm-dashboard';
import 'src/elements/sidebar/ngm-menu-item';
import LayersActions from '../layers/LayersActions';
import { DEFAULT_LAYER_OPACITY, LayerType } from '../constants';
import { flattenLayers, getDefaultLayerTree, LayerConfig } from '../layertree';
import {
  addAssetId,
  getAssetIds,
  getCesiumToolbarParam,
  getLayerParams,
  getSliceParam,
  getZoomToPosition,
  setCesiumToolbarParam,
  syncLayersParam,
} from 'src/permalink';
import i18next from 'i18next';
import 'fomantic-ui-css/components/accordion.js';
import type { Cartesian2, Viewer } from 'cesium';
import {
  BoundingSphere,
  Cartesian3,
  CustomDataSource,
  GeoJsonDataSource,
  HeadingPitchRange,
  Math as CMath,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
} from 'cesium';
import {
  showSnackbarError,
  showSnackbarInfo,
  showSnackbarSuccess,
} from 'src/notifications';
import auth from 'src/store/auth';
import './ngm-share-link';
import MainStore from 'src/store/main';
import ToolboxStore from 'src/store/toolbox';
import { classMap } from 'lit/directives/class-map.js';
import $ from 'jquery';
import { customElement, property, query, state } from 'lit/decorators.js';

import DashboardStore from 'src/store/dashboard';
import { getAssets } from 'src/api-ion';
import { clientConfigContext } from 'src/context';
import { ClientConfig } from 'src/api/client-config';
import { consume } from '@lit/context';
import { isSameLayer, LayerService } from 'src/features/layer/layer.service';
import { LayerInfoService } from 'src/features/layer/info/layer-info.service';
import { distinctUntilChanged, map, skip, take } from 'rxjs';
import { getLayersConfig } from 'src/swisstopoImagery';
import { run } from 'src/utils/fn.utils';

export type SearchLayer = SearchLayerWithLayer | SearchLayerWithSource;

interface BaseSearchLayer {
  label: string;
  title?: string;
}

export interface SearchLayerWithLayer extends BaseSearchLayer {
  layer: string;
}

export interface SearchLayerWithSource extends BaseSearchLayer {
  type?: LayerType;
  dataSourceName: string;
}

@customElement('ngm-side-bar')
export class SideBar extends LitElementI18n {
  @property({ type: Boolean })
  accessor mobileView = false;

  @property({ type: Boolean })
  accessor displayUndergroundHint = true;

  @consume({ context: clientConfigContext })
  accessor clientConfig!: ClientConfig;

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  @consume({ context: LayerInfoService.context() })
  accessor layerInfoService!: LayerInfoService;

  @state()
  accessor catalogLayers: LayerConfig[] | undefined;

  @state()
  accessor numberOfVisibleGeometries = 0;

  @state()
  accessor activePanel: string | null = null;

  @state()
  accessor showHeader = false;

  @state()
  accessor mobileShowAll = false;

  @state()
  accessor hideDataDisplayed = false;

  @state()
  accessor debugToolsActive = getCesiumToolbarParam();

  @query('.ngm-side-bar-panel > .ngm-toast-placeholder')
  accessor toastPlaceholder;

  private layerActions: LayersActions | undefined;

  private zoomedToPosition = false;

  private accordionInited = false;

  private shareListenerAdded = false;

  private readonly shareDownListener = (evt) => {
    if (!evt.composedPath().includes(this)) {
      this.closePanel();
    }
  };

  private viewer: Viewer | null = null;

  connectedCallback(): void {
    super.connectedCallback();

    MainStore.viewer.subscribe((viewer) => {
      this.viewer = viewer;
    });

    ToolboxStore.geometries.subscribe((geometries) => {
      this.numberOfVisibleGeometries = geometries.length;
    });

    auth.user.subscribe((user) => {
      if (user) {
        return;
      }

      // User logged out, remove restricted layers.
      for (const layer of this.layerService.activeLayers) {
        if (layer.restricted !== undefined && layer.restricted.length > 0) {
          this.layerService.deactivate(layer);
        }
      }
    });

    MainStore.setUrlLayersSubject.subscribe(async () => {
      this.layerService.activeLayers.forEach((layer) =>
        this.removeLayerWithoutSync(layer),
      );
      await this.syncActiveLayers();
      this.requestUpdate();
      MainStore.nextLayersRemove();
    });

    MainStore.syncLayerParams.subscribe(() => {
      syncLayersParam(this.layerService);
    });

    MainStore.onIonAssetAdd.subscribe((asset) => {
      const assetIds = getAssetIds();
      if (!asset.id || assetIds.includes(asset.id.toString())) {
        showSnackbarInfo(i18next.t('dtd_asset_exists_info'));
        return;
      }
      const token = MainStore.ionToken.value;
      if (!token) return;
      const layer: LayerConfig = {
        type: LayerType.tiles3d,
        assetId: asset.id,
        ionToken: token,
        label: asset.name,
        layer: asset.id.toString(),
        visible: true,
        displayed: false,
        opacityDisabled: true,
        pickable: true,
        customAsset: true,
      };
      this.layerService.activate(layer);
      addAssetId(asset.id);
      showSnackbarSuccess(i18next.t('dtd_asset_added'));
      this.requestUpdate();
      syncLayersParam(this.layerService);
    });

    MainStore.onRemoveIonAssets.subscribe(async () => {
      const assets = this.layerService.activeLayers.filter((l) => !!l.assetId);
      for (const asset of assets) {
        await this.removeLayerWithoutSync(asset);
      }
      this.viewer!.scene.requestRender();
      this.requestUpdate();
      syncLayersParam(this.layerService);
    });

    const sliceOptions = getSliceParam();
    if (sliceOptions?.type && sliceOptions.slicePoints) {
      this.openPanel('tools');
    }

    this.layerService.layerActivated$.subscribe((layer) => {
      this.maybeShowVisibilityHint(layer as LayerConfig);
    });

    // Rerender when layer counter changes.
    this.layerService.activeLayers$
      .pipe(
        map((it) => it.length),
        distinctUntilChanged(),
      )
      .subscribe(() => {
        this.requestUpdate();
      });
  }

  async togglePanel(panelName: string, showHeader = true) {
    this.showHeader = showHeader;
    if (this.activePanel === panelName) {
      this.closePanel(panelName);
    } else {
      this.openPanel(panelName);
    }
  }

  private openPanel(panelName: string): void {
    document.body.style.setProperty(
      '--sidebar-width',
      run(() => {
        switch (panelName) {
          case 'data':
            return '440px';
          case 'settings':
          case 'tools':
            return '250px';
          case 'dashboard':
            return 'min(1028px, calc(100vw - 144px))';
          case 'share':
            return '436px';
          default:
            return '';
        }
      }),
    );
    this.activePanel = panelName;
  }

  private readonly handlePanelClose = () => this.closePanel();

  private readonly closePanel = (panelName?: string): void => {
    if (DashboardStore.projectMode.value === 'edit') {
      DashboardStore.showSaveOrCancelWarning(true);
      return;
    }
    if (panelName === undefined || this.activePanel === panelName) {
      document.body.style.setProperty('--sidebar-width', '');
      this.activePanel = null;
    }
  };

  async syncActiveLayers() {
    const flatLayers = flattenLayers(this.catalogLayers!);
    const urlLayers = getLayerParams();
    const assetIds = getAssetIds();
    const ionToken = MainStore.ionToken.value;

    if (!urlLayers.length && !assetIds.length) {
      const activeLayers = flatLayers.filter((l) => l.displayed);
      this.layerService.set(activeLayers);
      syncLayersParam(this.layerService);
      return;
    }

    // First - make everything hidden
    flatLayers.forEach((l) => {
      l.visible = false;
      l.displayed = false;
    });

    const activeLayers: LayerConfig[] = [];
    for (const urlLayer of urlLayers) {
      let layer = flatLayers.find((fl) => fl.layer === urlLayer.layer) as
        | LayerConfig
        | undefined;
      if (!layer) {
        // Layers from the search are not present in the flat layers.
        layer = await this.createSearchLayer({
          layer: urlLayer.layer,
          label: urlLayer.layer,
        }); // the proper label will be taken from getCapabilities
      }
      layer.visible = urlLayer.visible;
      layer.opacity = urlLayer.opacity;
      layer.wmtsCurrentTime = urlLayer.timestamp ?? layer.wmtsCurrentTime;
      layer.setOpacity?.(layer.opacity);
      activeLayers.push(layer);
    }

    if (ionToken) {
      const ionAssetsRes = await getAssets(ionToken);
      const ionAssets = ionAssetsRes?.items || [];

      assetIds.forEach((assetId) => {
        const ionAsset = ionAssets.find(
          (asset) => asset.id === Number(assetId),
        );
        if (ionAsset) {
          MainStore.updateSelectedIonAssetIds(ionAsset);
        }
        const layer: LayerConfig = {
          type: LayerType.tiles3d,
          assetId: Number(assetId),
          ionToken: ionToken,
          label: ionAsset?.name ?? assetId,
          layer: assetId,
          visible: true,
          displayed: true,
          opacityDisabled: true,
          pickable: true,
          customAsset: true,
        };
        activeLayers.push(layer);
      });
    }

    this.layerService.set(activeLayers);
  }

  async willUpdate(changedProperties) {
    if (this.viewer && !this.layerActions) {
      this.layerActions = new LayersActions(this.viewer, this.layerService);
      if (!this.catalogLayers) {
        this.catalogLayers = getDefaultLayerTree(this.clientConfig);
        await this.syncActiveLayers();
      }
    }
    // hide share panel on any action outside side bar
    if (!this.shareListenerAdded && this.activePanel === 'share') {
      document.addEventListener('pointerdown', this.shareDownListener);
      document.addEventListener('keydown', this.shareDownListener);
      this.shareListenerAdded = true;
    } else if (this.shareListenerAdded) {
      this.shareListenerAdded = false;
      document.removeEventListener('pointerdown', this.shareDownListener);
      document.removeEventListener('keydown', this.shareDownListener);
    }
    super.willUpdate(changedProperties);
  }

  updated(changedProperties) {
    !this.zoomedToPosition && this.zoomToPermalinkObject();

    if (!this.accordionInited && this.activePanel === 'data') {
      const panelElement = this.querySelector('.ngm-layer-catalog');

      if (panelElement) {
        for (let i = 0; i < panelElement.childElementCount; i++) {
          const element = panelElement.children.item(i);
          if (element?.classList.contains('accordion')) {
            $(element).accordion({ duration: 150 });
          }
        }
        this.accordionInited = true;
      }
    }

    super.updated(changedProperties);
  }

  // adds layer from search to 'Displayed Layers'
  async addLayerFromSearch(searchLayer: SearchLayer) {
    const flatLayers = flattenLayers(this.catalogLayers!);

    let layer: LayerConfig | undefined;
    if ('dataSourceName' in searchLayer) {
      layer = flatLayers.find((l) => l.type === searchLayer.dataSourceName); // check for layers like earthquakes
    } else {
      layer = flatLayers.find((l) => isSameLayer(l, searchLayer)); // check for swisstopoWMTS layers
    }

    layer ??= this.layerService.activeLayers.find((l) =>
      isSameLayer(l, searchLayer),
    );

    if (layer === undefined) {
      // Create new layer
      layer = await this.createSearchLayer(searchLayer);
      if (layer.promise === undefined && layer.load !== undefined) {
        layer.promise = layer.load();
      }
    }
    this.layerService.activate(layer);
  }

  async createSearchLayer(searchLayer: SearchLayer): Promise<LayerConfig> {
    const config = run(() => {
      if ('dataSourceName' in searchLayer) {
        const config = searchLayer as LayerConfig;
        config.visible = true;
        config.origin = 'layer';
        config.label = searchLayer.title ?? searchLayer.label;
        config.legend =
          config.type === LayerType.swisstopoWMTS ? config.layer : undefined;
        return config;
      } else {
        return {
          type: LayerType.swisstopoWMTS,
          label: searchLayer.title ?? searchLayer.label,
          layer: searchLayer.layer,
          visible: true,
          displayed: false,
          opacity: DEFAULT_LAYER_OPACITY,
          queryType: 'geoadmin',
          legend: searchLayer.layer,
        };
      }
    });
    if (config.layer !== undefined) {
      const layers = await getLayersConfig();
      config.label = layers[config.layer]?.title ?? config.label;
    }
    return config;
  }

  zoomToPermalinkObject() {
    this.zoomedToPosition = true;
    const zoomToPosition = getZoomToPosition();
    if (!zoomToPosition) {
      return;
    }
    let altitude = 0;
    let cartesianPosition: Cartesian3 | undefined;
    let windowPosition: Cartesian2 | undefined;
    const updateValues = () => {
      altitude =
        this.viewer!.scene.globe.getHeight(
          this.viewer!.scene.camera.positionCartographic,
        ) ?? 0;
      cartesianPosition = Cartesian3.fromDegrees(
        zoomToPosition.longitude,
        zoomToPosition.latitude,
        zoomToPosition.height + altitude,
      );
      windowPosition =
        this.viewer!.scene.cartesianToCanvasCoordinates(cartesianPosition);
    };
    updateValues();
    this.zoomToObjectCoordinates(cartesianPosition, () => {
      if (windowPosition == null) {
        return;
      }
      let maxTries = 25;
      let tryCount = 0;
      const eventHandler = new ScreenSpaceEventHandler(this.viewer!.canvas);
      eventHandler.setInputAction(
        () => (maxTries = 0),
        ScreenSpaceEventType.LEFT_DOWN,
      );
      // Waits while will be possible to select an object
      const tryToSelect = () =>
        setTimeout(() => {
          updateValues();
          this.zoomToObjectCoordinates(cartesianPosition);
          if (windowPosition == null) {
            return;
          }

          this.layerInfoService.infos$
            .pipe(skip(1), take(1))
            .subscribe((infos) => {
              if (infos.length === 0 && tryCount <= maxTries) {
                tryToSelect();
              } else {
                eventHandler.destroy();
                if (tryCount > maxTries) {
                  showSnackbarError(
                    i18next.t('dtd_object_on_coordinates_not_found_warning'),
                  );
                }
              }
            });
          this.layerInfoService.pick2d(windowPosition);
          tryCount += 1;
        }, 500);
      tryToSelect();
    });
  }

  zoomToObjectCoordinates(center, complete?) {
    const boundingSphere = new BoundingSphere(center, 1000);
    const zoomHeadingPitchRange = new HeadingPitchRange(
      0,
      -CMath.toRadians(45),
      boundingSphere.radius,
    );
    this.viewer!.scene.camera.flyToBoundingSphere(boundingSphere, {
      duration: 0,
      offset: zoomHeadingPitchRange,
      complete: complete,
    });
  }

  maybeShowVisibilityHint(config: LayerConfig) {
    if (
      this.displayUndergroundHint &&
      config.visible &&
      [LayerType.tiles3d, LayerType.earthquakes].includes(config.type!) &&
      !this.viewer?.scene.cameraUnderground
    ) {
      showSnackbarInfo(i18next.t('lyr_subsurface_hint'), {
        displayTime: 20000,
      });
      this.displayUndergroundHint = false;
    }
  }

  private async removeLayerWithoutSync(layer: LayerConfig): Promise<void> {
    if (!layer.setVisibility) {
      const c = await layer.promise;
      if (c instanceof CustomDataSource || c instanceof GeoJsonDataSource) {
        this.viewer!.dataSources.getByName(c.name)[0].show = false;
      }
    }
    this.layerService.deactivate(layer);
    if (layer.ionToken && layer.assetId) {
      MainStore.removeIonAssetId(layer.assetId);
    }
  }

  toggleDebugTools(event) {
    const active = event.target.checked;
    this.debugToolsActive = active;
    setCesiumToolbarParam(active);
    this.dispatchEvent(
      new CustomEvent('toggleDebugTools', { detail: { active } }),
    );
  }

  createRenderRoot() {
    return this;
  }

  render() {
    const layerBtn = this.renderMenuItem(
      'layer',
      'menu_layers',
      'data',
      this.layerService.activeLayers.length,
    );
    const toolsBtn = this.renderMenuItem(
      'tools',
      'menu_tools',
      'tools',
      this.numberOfVisibleGeometries,
    );
    const projectsBtn = this.renderMenuItem(
      'projects',
      'menu_projects',
      'dashboard',
    );
    const shareBtn = this.renderMenuItem('share', 'menu_share', 'share');
    const settingsBtn = this.renderMenuItem(
      'config',
      'menu_settings',
      'settings',
    );
    const mobileExpandBtn = html` <ngm-menu-item
      icon="${this.mobileShowAll ? 'viewLess' : 'viewAll'}"
      @click=${() => (this.mobileShowAll = !this.mobileShowAll)}
    ></ngm-menu-item>`;

    return html`
      <div
        .hidden=${!this.mobileView || !this.mobileShowAll}
        class="ngm-menu-mobile"
      >
        ${shareBtn} ${settingsBtn}
        <!-- required for correct positioning -->
        <div></div>
        <div></div>
      </div>
      <div class="ngm-menu">
        <div class="ngm-menu-top">
          ${layerBtn} ${toolsBtn} ${!this.mobileView ? shareBtn : ''}
          ${projectsBtn} ${this.mobileView ? mobileExpandBtn : ''}
        </div>
        <div ?hidden="${this.mobileView}" class="ngm-menu-top">
          ${settingsBtn}
        </div>
      </div>
      <ngm-dashboard
        class="ngm-side-bar-panel ngm-large-panel"
        ?hidden=${this.activePanel !== 'dashboard'}
        @close=${this.handlePanelClose}
      ></ngm-dashboard>
      <ngm-layer-panel
        ?hidden="${this.activePanel !== 'data'}"
        .layers="${this.catalogLayers ?? []}"
        @close="${this.handlePanelClose}"
      ></ngm-layer-panel>
      <div .hidden=${this.activePanel !== 'tools'} class="ngm-side-bar-panel">
        <ngm-tools
          .toolsHidden=${this.activePanel !== 'tools'}
          @open=${() => this.openPanel('tools')}
          @close=${this.handlePanelClose}
        ></ngm-tools>
      </div>
      <div
        .hidden=${this.activePanel !== 'share'}
        class="ngm-side-bar-panel ngm-share-panel"
      >
        <div class="ngm-panel-header">
          ${i18next.t('lsb_share')}
          <div class="ngm-close-icon" @click=${this.handlePanelClose}></div>
        </div>
        ${this.activePanel !== 'share'
          ? ''
          : html` <ngm-share-link></ngm-share-link>`}
      </div>
      <div
        .hidden=${this.activePanel !== 'settings'}
        class="ngm-side-bar-panel"
      >
        <div class="ngm-panel-header">
          ${i18next.t('lsb_settings')}
          <div class="ngm-close-icon" @click=${this.handlePanelClose}></div>
        </div>
        <div class="toolbar-settings">
          <div class="inner-toolbar-settings">
            <label>${i18next.t('lsb_debug_tools')}</label>
            <div
              class="ngm-checkbox ngm-debug-tools-toggle ${classMap({
                active: this.debugToolsActive,
              })}"
              @click=${() =>
                (<HTMLInputElement>(
                  this.querySelector('.ngm-debug-tools-toggle > input')
                )).click()}
            >
              <input
                type="checkbox"
                ?checked=${this.debugToolsActive}
                @change="${this.toggleDebugTools}"
              />
              <span class="ngm-checkbox-icon"></span>
              <label>${i18next.t('lsb_cesium_toolbar_label')}</label>
            </div>
            <a
              class="contact-mailto-link"
              target="_blank"
              href="mailto:swissgeol@swisstopo.ch"
              >${i18next.t('contact_mailto_text')}</a
            >
            <a
              class="disclaimer-link"
              target="_blank"
              href="${i18next.t('disclaimer_href')}"
              >${i18next.t('disclaimer_text')}</a
            >
          </div>
        </div>
      </div>
    `;
  }

  private readonly renderMenuItem = (
    icon: string,
    title: string,
    panel: string,
    counter = 0,
  ) => html`
    <ngm-menu-item
      data-cy="${`menu-item--${panel}`}"
      .icon=${icon}
      .title=${title}
      .counter="${counter}"
      ?isActive=${this.activePanel === panel}
      ?isMobile=${this.mobileView}
      @click=${() => this.togglePanel(panel)}
    ></ngm-menu-item>
  `;
}
