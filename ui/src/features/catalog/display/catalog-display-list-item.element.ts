import { consume } from '@lit/context';
import { customElement, property, state } from 'lit/decorators.js';
import {
  CoreElement,
  CoreWindow,
  CoreWindowProps,
  dropdown,
  tooltip,
} from 'src/features/core';
import { CoreTooltip } from 'src/features/core/core-tooltip.element';
import { LayerService } from 'src/features/layer/layer.service';
import {
  AnyLayer,
  BACKGROUND_LAYER,
  getLayerLabel,
  is3dLayer,
  isBackgroundLayer,
  isBasemapLockedLayer,
  isDefaultSliceSelection,
  Layer,
  LayerType,
  Tiles3dLayerController,
} from 'src/features/layer';
import { css, html } from 'lit';
import { Id } from 'src/models/id.model';
import i18next from 'i18next';
import { applyTypography } from 'src/styles/theme';
import { when } from 'lit/directives/when.js';
import { SliderChangeEvent } from 'src/features/core/core-slider.element';
import { throttle } from 'src/utils/fn.utils';
import { classMap } from 'lit/directives/class-map.js';
import { getTranslatedString } from 'src/models/translated-string.model';

@customElement('ngm-catalog-display-list-item')
export class CatalogDisplayListItem extends CoreElement {
  @property({ reflect: true, attribute: 'layer-id' })
  accessor layerId!: Id<AnyLayer>;

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  @state()
  accessor layer!: AnyLayer;

  @state()
  accessor isOpacityActive = false;

  @state()
  accessor isBackgroundActive = false;

  @state()
  accessor canZoom = true;

  @state()
  accessor isBackgroundVisible = true;

  private windows!: WindowMapping;
  private canZoomPollIntervalId: ReturnType<typeof setInterval> | null = null;

  connectedCallback() {
    super.connectedCallback();

    this.windows = getWindowsOfLayer(this.layerId);

    this.register(
      this.layerService.layer$(this.layerId).subscribe((layer) => {
        this.layer = layer;
        this.syncPresentation();
        this.updateCanZoom();
      }),
    );
    this.register(
      this.layerService.layer$(BACKGROUND_LAYER.id).subscribe((background) => {
        this.isBackgroundVisible = background.isVisible;
        this.syncPresentation();
      }),
    );
  }

  private get isSuppressedByBasemap(): boolean {
    return (
      this.layer != null &&
      isBasemapLockedLayer(this.layer) &&
      !this.isBackgroundVisible
    );
  }

  private get isEffectivelyVisible(): boolean {
    return (
      this.layer != null && this.layer.isVisible && !this.isSuppressedByBasemap
    );
  }

  private get isOpacityDisabled(): boolean {
    return (
      this.layer == null ||
      this.isSuppressedByBasemap ||
      !this.layer.isVisible ||
      !this.layer.canUpdateOpacity
    );
  }

  private get opacityTooltipKey(): string {
    if (this.isSuppressedByBasemap) {
      return 'catalog:display.requires_basemap';
    }
    if (this.layer != null && !this.layer.isVisible) {
      return 'catalog:display.opacity_requires_visible';
    }
    return 'catalog:display.opacity';
  }

  /**
   * Reflect stored visibility, unless the basemap is hiding a draped layer.
   * That hide is temporary: the stored eye state comes back with the basemap.
   */
  private syncPresentation(): void {
    if (this.layer == null) {
      return;
    }
    if (this.isEffectivelyVisible) {
      this.setAttribute('visible', '');
    } else {
      this.removeAttribute('visible');
    }
    if (this.isSuppressedByBasemap && this.isOpacityActive) {
      this.isOpacityActive = false;
      this.classList.remove('has-active-opacity');
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopCanZoomPolling();
  }

  private stopCanZoomPolling(): void {
    if (this.canZoomPollIntervalId !== null) {
      clearInterval(this.canZoomPollIntervalId);
      this.canZoomPollIntervalId = null;
    }
  }

  private updateCanZoom(): void {
    this.stopCanZoomPolling();

    const controller = this.layerService.controller(this.layerId);
    if (!controller) {
      this.canZoom = false;
      return;
    }

    if (!(controller instanceof Tiles3dLayerController)) {
      this.canZoom = true;
      return;
    }

    this.canZoom = !!controller.tileset?.boundingSphere;
    if (this.canZoom) {
      return;
    }

    // Tileset and slice metadata finish loading asynchronously after
    // activation. Poll until readiness is actually observed rather than
    // giving up after a fixed timeout — otherwise a tileset that becomes
    // ready after the timeout would leave the zoom button permanently
    // disabled. Polling is stopped as soon as it succeeds, the layer/
    // controller changes (see `updateCanZoom` call above), or the element
    // disconnects (see `disconnectedCallback`).
    this.canZoomPollIntervalId = setInterval(() => {
      if (this.layerService.controller(this.layerId) !== controller) {
        // Controller was swapped out (e.g. layer deactivated/reactivated) —
        // the subscription above will have already called `updateCanZoom()`
        // for the new controller, so just stop this stale poll.
        this.stopCanZoomPolling();
        return;
      }
      const isReady = !!controller.tileset?.boundingSphere;
      if (isReady) {
        this.canZoom = true;
        this.stopCanZoomPolling();
      }
    }, 100);
  }

  updated() {
    if (
      this.layer.type === 'Background' ||
      this.isOpacityActive ||
      this.isBackgroundActive
    ) {
      this.removeAttribute('sortable');
    } else {
      this.setAttribute('sortable', 'true');
    }
    this.bindTooltip('.visibility-tip', '.visibility-control');
    this.bindTooltip('.opacity-tip', '.opacity-control');
  }

  /**
   * Point the tooltip at its control directly.
   * Sibling lookup is unreliable for the eye: the drag handle is painted on
   * top of it and steals the hover.
   */
  private bindTooltip(tipSelector: string, anchorSelector: string): void {
    const tip = this.renderRoot.querySelector(tipSelector);
    const anchor = this.renderRoot.querySelector(anchorSelector);
    if (
      !(tip instanceof CoreTooltip) ||
      anchor == null ||
      tip.target === anchor
    ) {
      return;
    }
    tip.target = anchor;
  }

  private readonly toggleVisibility = (): void => {
    if (this.isSuppressedByBasemap) {
      return;
    }
    if (this.layer.isVisible) {
      this.isOpacityActive = false;
    }
    this.layerService.update(this.layerId, {
      isVisible: !this.layer.isVisible,
    });
  };

  private readonly toggleOpacityActive = (): void => {
    if (this.isOpacityDisabled) {
      return;
    }
    this.isBackgroundActive = false;
    this.isOpacityActive = !this.isOpacityActive;
    this.classList.toggle('has-active-opacity', this.isOpacityActive);
  };

  private readonly toggleBackgroundActive = (): void => {
    this.isOpacityActive = false;
    this.isBackgroundActive = !this.isBackgroundActive;
  };

  private readonly zoomToLayer = async (): Promise<void> => {
    this.layerService.controller(this.layer.id)?.zoomIntoView();
  };

  private readonly removeLayer = (): void => {
    this.layerService.deactivate(this.layer.id as Id<Layer>);
  };

  private openWindow(
    name: keyof typeof this.windows,
    options: Omit<CoreWindowProps, 'onClose'>,
  ): void {
    if (this.windows[name] !== null) {
      return;
    }
    this.windows[name] = CoreWindow.open({
      ...options,
      onClose: () => {
        this.windows[name] = null;
        this.requestUpdate();
      },
    });
    this.requestUpdate();
  }

  private readonly openLegend = (): void =>
    this.openWindow('legend', {
      title: () => getLayerLabel(this.layer),
      body: () => html`
        <ngm-catalog-display-info-box-detail
          .layerId=${this.layer.id}
        ></ngm-catalog-display-info-box-detail>
      `,
    });

  private readonly openTimes = (): void =>
    this.openWindow('times', {
      title: () => getLayerLabel(this.layer),
      body: () => html`
        <ngm-catalog-display-times-detail
          .layerId=${this.layer.id}
        ></ngm-catalog-display-times>
      `,
    });

  private readonly openVoxelFilter = (): void =>
    this.openWindow('voxelFilter', {
      title: () => getLayerLabel(this.layer),
      body: () => html`
        <ngm-catalog-display-voxel-filter-detail
          .layerId=${this.layer.id}
        ></ngm-catalog-display-voxel-filter-detail>
      `,
    });

  private readonly openTiffFilter = (): void =>
    this.openWindow('tiffFilter', {
      title: () =>
        i18next.t('catalog:tiffBandsWindow.title', {
          layer: getLayerLabel(this.layer),
        }),
      body: () => html`
        <catalog-display-layer-tiff-bands
          .layerId=${this.layer.id}
        ></catalog-display-layer-tiff-bands>
      `,
    });

  private readonly openSlice = (): void =>
    this.openWindow('slice', {
      title: () =>
        i18next.t('catalog:slice_window.title', {
          layer: getLayerLabel(this.layer),
        }),
      body: () => html`
        <ngm-catalog-display-slice-detail
          .layerId=${this.layer.id}
        ></ngm-catalog-display-slice-detail>
      `,
    });

  private get tiles3dController(): Tiles3dLayerController | null {
    if (this.layer.type !== LayerType.Tiles3d) {
      return null;
    }
    const controller = this.layerService.controller(this.layer.id);
    return controller instanceof Tiles3dLayerController ? controller : null;
  }

  private get supportsSliceSelection(): boolean {
    return this.tiles3dController?.supportsSliceSelection === true;
  }

  private get isSliceFilterActive(): boolean {
    if (!this.supportsSliceSelection) {
      return false;
    }
    if (this.windows.slice !== null) {
      return true;
    }
    const selection =
      this.layer.type === LayerType.Tiles3d ? this.layer.sliceSelection : null;
    const defaults = this.tiles3dController?.getDefaultSliceSelection() ?? null;
    if (selection === null || defaults === null) {
      return false;
    }
    return !isDefaultSliceSelection(selection, defaults);
  }

  private readonly handleOpacityChangeEvent = throttle(
    (event: SliderChangeEvent): void => {
      this.layerService.update(this.layerId, { opacity: event.detail.value });
    },
    50,
  );

  readonly render = () => {
    const title = isBackgroundLayer(this.layer)
      ? i18next.t(`layers:backgrounds.${this.layer.activeVariantId}`)
      : getLayerLabel(this.layer);
    this.setAttribute('title', title);
    return html`
      ${when(!isBackgroundLayer(this.layer), this.renderDragHandle)}

      <div class="main">
        <span
          class="visibility-control ${classMap({
            'disabled-control': this.isSuppressedByBasemap,
          })}"
        >
          <ngm-core-button
            transparent
            variant="tertiary"
            shape="icon"
            data-cy="visibility"
            ?disabled="${this.isSuppressedByBasemap}"
            @click="${this.toggleVisibility}"
          >
            <ngm-core-icon
              icon="${this.isEffectivelyVisible ? 'visible' : 'hidden'}"
            ></ngm-core-icon>
          </ngm-core-button>
          ${when(
            this.isSuppressedByBasemap,
            () => html`<span class="disabled-hit"></span>`,
          )}
        </span>
        ${when(
          this.isSuppressedByBasemap,
          () => html`
            <ngm-core-tooltip
              class="visibility-tip"
              .content="${i18next.t('catalog:display.requires_basemap')}"
            ></ngm-core-tooltip>
          `,
        )}

        <div class="title-row">
          <span class="title">${title}</span>
          ${when(
            is3dLayer(this.layer),
            () => html`<ngm-core-chip class="dimension">3D</ngm-core-chip>`,
          )}
        </div>
        <div class="suffix">
          ${when(
            isBackgroundLayer(this.layer),
            () => html`
              <ngm-core-button
                transparent
                variant="secondary"
                shape="chip"
                class="background-toggle"
                ?active="${this.isBackgroundActive}"
                data-cy="background"
                @click="${this.toggleBackgroundActive}"
              >
                ${i18next.t('catalog:display.background')}
              </ngm-core-button>
            `,
          )}
          <span
            class="opacity-control ${classMap({
              'disabled-control': this.isOpacityDisabled,
            })}"
          >
            <ngm-core-button
              transparent
              variant="secondary"
              shape="chip"
              class="opacity-toggle"
              ?active="${this.isOpacityActive}"
              ?disabled="${this.isOpacityDisabled}"
              data-cy="opacity"
              @click="${this.toggleOpacityActive}"
            >
              ${Math.round(this.layer.opacity * 100)}%
            </ngm-core-button>
            ${when(
              this.isOpacityDisabled,
              () => html`<span class="disabled-hit"></span>`,
            )}
          </span>
          <ngm-core-tooltip
            class="opacity-tip"
            .content="${i18next.t(this.opacityTooltipKey)}"
          ></ngm-core-tooltip>
          ${when(
            this.supportsSliceSelection,
            () => html`
              <ngm-core-button
                transparent
                variant="tertiary"
                shape="icon"
                class="slice-filter"
                ?active="${this.isSliceFilterActive}"
                data-cy="slice-filter"
                @click="${this.openSlice}"
              >
                <ngm-core-icon icon="filter"></ngm-core-icon>
              </ngm-core-button>
              ${tooltip(i18next.t('catalog:display.slice'))}
            `,
          )}
          ${when(!isBackgroundLayer(this.layer), this.renderActions)}
        </div>
      </div>
      ${when(this.isOpacityActive, this.renderOpacity)}
      ${when(this.isBackgroundActive, this.renderBackground)}
    `;
  };

  private readonly renderActions = () => html`
    <ngm-core-button
      transparent
      variant="tertiary"
      shape="icon"
      class="actions"
    >
      <ngm-core-icon icon="menu"></ngm-core-icon>
    </ngm-core-button>
    ${dropdown(html`
      <ngm-core-dropdown-item
        role="button"
        ?disabled="${!this.canZoom}"
        @click="${this.zoomToLayer}"
      >
        <ngm-core-icon icon="zoomPlus"></ngm-core-icon>
        ${i18next.t('dtd_zoom_to')}
      </ngm-core-dropdown-item>
      ${when(
        this.layer.geocatId !== null,
        () => html`
          <ngm-core-dropdown-item role="link">
            <a
              href="${i18next.t('layers:geocat_url', {
                id: this.layer.geocatId,
              })}"
              target="_blank"
              rel="noopener"
            >
              <ngm-core-icon icon="geocat"></ngm-core-icon>
              Geocat
            </a>
          </ngm-core-dropdown-item>
        `,
      )}
      ${when(
        this.layer.infoBox !== null,
        () => html`
          <ngm-core-dropdown-item role="button" @click="${this.openLegend}">
            <ngm-core-icon icon="legend"></ngm-core-icon>
            ${i18next.t('catalog:display.info_box')}
          </ngm-core-dropdown-item>
        `,
      )}
      ${when(
        this.layer.downloadUrl !== null,
        () => html`
          <ngm-core-dropdown-item role="link">
            <a
              href="${getTranslatedString(this.layer.downloadUrl)}"
              target="_blank"
              rel="external noopener"
            >
              <ngm-core-icon icon="download"></ngm-core-icon>
              ${i18next.t('catalog:display.download')}
            </a>
          </ngm-core-dropdown-item>
        `,
      )}
      ${when(
        this.layer.type === LayerType.Voxel,
        () => html`
          <ngm-core-dropdown-item
            role="button"
            @click="${this.openVoxelFilter}"
          >
            <ngm-core-icon icon="filter"></ngm-core-icon>
            ${i18next.t('catalog:display.filter')}
          </ngm-core-dropdown-item>
        `,
      )}
      ${when(
        this.supportsSliceSelection,
        () => html`
          <ngm-core-dropdown-item role="button" @click="${this.openSlice}">
            <ngm-core-icon icon="filter"></ngm-core-icon>
            ${i18next.t('catalog:display.slice')}
          </ngm-core-dropdown-item>
        `,
      )}
      ${
        this.layer.type === LayerType.Tiff
          ? html`
              <ngm-core-dropdown-item
                role="button"
                @click="${this.openTiffFilter}"
              >
                <ngm-core-icon icon="filter"></ngm-core-icon>
                ${i18next.t('catalog:tiffBandsWindow.open')}
              </ngm-core-dropdown-item>
            `
          : ''
      }
      ${when(
        this.layer.type === LayerType.Wmts && this.layer.times !== null,
        () => html`
          <ngm-core-dropdown-item role="button" @click="${this.openTimes}">
            <ngm-core-icon icon="turnPage"></ngm-core-icon>
            ${i18next.t('catalog:display.time_travel')}
          </ngm-core-dropdown-item>
        `,
      )}
      <ngm-core-dropdown-item role="button" @click="${this.removeLayer}">
        <ngm-core-icon icon="trash"></ngm-core-icon>
        ${i18next.t('catalog:display.remove')}
      </ngm-core-dropdown-item>
    `)}
  `;

  private readonly renderOpacity = () => html`
    <hr />
    <div class="opacity">
      <ngm-core-slider
        .value="${this.layer.opacity}"
        .min="${0}"
        .max="${1}"
        .step="${0.01}"
        @change="${this.handleOpacityChangeEvent}"
      ></ngm-core-slider>
    </div>
  `;

  private readonly renderBackground = () => html`
    <hr />
    <ngm-background-layer-select></ngm-background-layer-select>
  `;

  readonly renderDragHandle = () => html`
    <div class="handle">
      <ngm-core-button variant="tertiary" shape="icon">
        <ngm-core-icon icon="grab"></ngm-core-icon>
      </ngm-core-button>
    </div>
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      position: relative;
      display: flex;
      flex-direction: column;
      padding: 9px;
      gap: 16px;
      user-select: none;

      border-radius: 4px;
      background-color: var(--color-bg--white);
      border: 1px solid var(--color-bg--white);
    }

    :host([sortable]) {
      cursor: grab;
    }

    :host(:hover:not(.is-in-drag)),
    :host(.has-active-opacity),
    :host(.is-dragged) {
      background-color: var(--color-bg--white--hovered);
      border-color: var(--color-hovered);
    }

    :host(.is-dragged),
    :host(.is-in-drag) {
      cursor: grabbing;
    }

    :host > hr {
      --offset-h: 9px;

      margin: 0 var(--offset-h);
      width: calc(100% - var(--offset-h) * 2);
      height: 1px;
      border: 0;
      background-color: var(--color-border--emphasis-high);
    }

    :host(:not([visible])) {
      color: var(--color-text--disabled);
    }

    /* main */

    :host > .main {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* main suffix */

    .suffix {
      display: flex;
      align-items: center;
      gap: 3px;
    }

    .suffix:not(:has(ngm-core-button.actions)) {
      padding-right: 39px;
    }

    /* visibility */

    .visible > ngm-core-icon {
      color: var(--color-primary);
    }

    .visibility-control,
    .opacity-control {
      display: inline-flex;
    }

    .disabled-control {
      position: relative;
      z-index: 1;
      cursor: not-allowed;
    }

    .disabled-control > ngm-core-button {
      pointer-events: none;
    }

    .disabled-hit {
      position: absolute;
      inset: 0;
      cursor: not-allowed;
    }

    /* title */

    .title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      min-width: 0;
    }

    .title {
      ${applyTypography('body-2')};
      flex: 0 1 auto;
      min-width: 0;

      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .title-row ngm-core-chip {
      flex-shrink: 0;
    }

    /* opacity */

    ngm-core-button.opacity-toggle {
      width: 61px;
    }

    .opacity {
      display: flex;
      align-items: center;
      padding: 0 9px 11px 9px;
      gap: 6px;
    }

    /* background select */

    ngm-background-layer-select {
      padding: 0 9px;
    }

    /* grab handle */

    .handle {
      position: absolute;
      left: -11px;
      top: 0;
      bottom: 0;
      margin: auto 0;

      width: fit-content;
      height: fit-content;
    }

    .handle ngm-core-button {
      --button-padding: 0;
      --button-border: var(--color-border--default);
      --button-icon-width: 16px;
      --button-icon-height: 22px;
    }

    :host(:not(:hover)) .handle {
      display: none;
    }
  `;
}

type WindowName = 'legend' | 'times' | 'voxelFilter' | 'tiffFilter' | 'slice';

type WindowMapping = Record<WindowName, CoreWindow | null>;

/**
 * A collection of all currently open windows, mapped to the layer to which they belong.
 *
 * This is kept outside the layer's component itself,
 * which enables us to close the catalog itself, while keeping the windows open.
 *
 * Cleanup is done when a layer is deactivated.
 */
const windowMappingsByLayerId = new Map<Id<AnyLayer>, WindowMapping>();

const getWindowsOfLayer = (layerId: Id<AnyLayer>): WindowMapping => {
  const mapping = windowMappingsByLayerId.get(layerId);
  if (mapping !== undefined) {
    return mapping;
  }
  const newMapping: WindowMapping = {
    legend: null,
    tiffFilter: null,
    times: null,
    voxelFilter: null,
    slice: null,
  };
  windowMappingsByLayerId.set(layerId, newMapping);
  return newMapping;
};

LayerService.inject().then((layerService) => {
  // Close the windows of any deactivated layer.
  layerService.layerDeactivated$.subscribe((layerId) => {
    const mapping = windowMappingsByLayerId.get(layerId);
    if (mapping === undefined) {
      return;
    }
    for (const window of Object.values(mapping)) {
      if (window !== null) {
        window.close();
      }
    }
    windowMappingsByLayerId.delete(layerId);
  });
});
