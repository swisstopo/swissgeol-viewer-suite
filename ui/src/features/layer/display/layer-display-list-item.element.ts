import { customElement, property, state } from 'lit/decorators.js';
import { css, html, PropertyValues } from 'lit';
import { applyTransition, applyTypography } from 'src/styles/theme';
import { SliderChangeEvent } from 'src/features/core/core-slider.element';
import { classMap } from 'lit/directives/class-map.js';
import { CoreElement, CoreWindow, dropdown, tooltip } from 'src/features/core';
import { LayerConfig, LayerType } from 'src/layertree';
import MainStore from 'src/store/main';
import { Entity, Viewer } from 'cesium';
import i18next from 'i18next';
import { LayerService } from 'src/features/layer/layer.service';
import { consume } from '@lit/context';
import { LayerTiffController } from 'src/features/layer';
import { OgcService } from 'src/features/ogc';

@customElement('ngm-layer-display-list-item')
export class LayerDisplayListItem extends CoreElement {
  @property({ type: Object })
  accessor layer: LayerConfig | null = null;

  @property({ type: String })
  accessor title = '';

  @property({ type: String })
  accessor label: string | null = null;

  @property({ type: Boolean, attribute: 'visible', reflect: true })
  accessor isVisible = false;

  @property({ type: Boolean, attribute: 'draggable', reflect: true })
  accessor isDraggable = false;

  @property({ type: Number })
  accessor opacity = 1;

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  @consume({ context: OgcService.context() })
  accessor ogcService!: OgcService;

  @state()
  accessor isOpacityActive = false;

  @state()
  accessor isBackgroundActive = false;

  private viewer!: Viewer;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this.toggleVisibility = this.toggleVisibility.bind(this);
    this.toggleOpacityActive = this.toggleOpacityActive.bind(this);
    this.toggleBackgroundActive = this.toggleBackgroundActive.bind(this);
    this.handleOpacityChangeEvent = this.handleOpacityChangeEvent.bind(this);
    this.zoomToLayer = this.zoomToLayer.bind(this);
    this.removeLayer = this.removeLayer.bind(this);
    this.openLegend = this.openLegend.bind(this);
    this.openVoxelFilter = this.openVoxelFilter.bind(this);
    this.openTiffFilter = this.openTiffFilter.bind(this);
    this.openWmtsDatePicker = this.openWmtsDatePicker.bind(this);

    this.register(
      MainStore.viewer.subscribe((viewer) => {
        this.viewer = viewer!;
      }),
    );
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.register(
      this.layerService.activeLayers$.subscribe(() => {
        this.requestUpdate();
      }),
    );
  }

  private toggleVisibility(): void {
    if (this.isVisible) {
      this.isOpacityActive = false;
    }
    this.dispatchEvent(
      new CustomEvent<VisibilityChangeEventDetail>('visibility-changed', {
        detail: {
          isVisible: !this.isVisible,
        },
      }),
    );
  }

  private toggleOpacityActive(): void {
    this.isBackgroundActive = false;
    this.isOpacityActive = !this.isOpacityActive;
    this.classList.toggle('has-active-opacity', this.isOpacityActive);
  }

  private toggleBackgroundActive(): void {
    this.isOpacityActive = false;
    this.isBackgroundActive = !this.isBackgroundActive;
  }

  private handleOpacityChangeEvent(event: SliderChangeEvent): void {
    this.dispatchEvent(
      new CustomEvent<OpacityChangeEventDetail>('opacity-changed', {
        detail: {
          opacity: event.detail.value,
        },
      }),
    );
  }

  private async zoomToLayer(): Promise<void> {
    if (this.layer?.promise == null) {
      return;
    }
    const entity = await this.layer.promise;
    if (entity instanceof LayerTiffController) {
      entity.zoomIntoView();
      return;
    }
    await this.viewer.flyTo(entity as unknown as Entity);
  }

  private removeLayer(): void {
    if (this.layer == null) {
      return;
    }
    this.layerService.deactivate(this.layer);
  }

  private get geocatUrl(): string | null {
    if (this.layer?.geocatId == null) {
      return null;
    }
    const lang = GEOCAT_LANGUAGE_MAPPING[i18next.language];
    return `https://www.geocat.ch/geonetwork/srv/${lang}/catalog.search#/metadata/${this.layer.geocatId}`;
  }

  private openLegend(): void {
    if (this.layer?.legend == null) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent('showLayerLegend', {
        composed: true,
        bubbles: true,
        detail: {
          config: this.layer,
        },
      }),
    );
  }

  private openVoxelFilter(): void {
    this.dispatchEvent(
      new CustomEvent('showVoxelFilter', {
        composed: true,
        bubbles: true,
        detail: {
          config: this.layer,
        },
      }),
    );
  }

  private tiffFilterWindow: CoreWindow | null = null;

  private openTiffFilter(): void {
    if (this.tiffFilterWindow !== null || this.layer === null) {
      return;
    }
    this.tiffFilterWindow = CoreWindow.open({
      title: () =>
        i18next.t('layers:geoTIFF.bandsWindow.title', { layer: this.title }),
      body: () => html`
        <ngm-layer-tiff-bands .layer="${this.layer}"></ngm-layer-tiff-bands>
      `,
      onClose: () => {
        this.tiffFilterWindow = null;
      },
    });
  }

  private openWmtsDatePicker(): void {
    this.dispatchEvent(
      new CustomEvent('showWmtsDatePicker', {
        composed: true,
        bubbles: true,
        detail: {
          config: this.layer,
        },
      }),
    );
  }

  protected updated(_changedProperties: PropertyValues) {
    this.tiffFilterWindow?.rerender();
  }

  readonly render = () => html`
    ${this.isDraggable ? this.renderDragHandle() : ''}

    <div class="main" title="${this.title}">
      <ngm-core-button
        transparent
        variant="tertiary"
        shape="icon"
        data-cy="visibility"
        @click="${this.toggleVisibility}"
      >
        <ngm-core-icon
          icon="${this.isVisible ? 'visible' : 'hidden'}"
        ></ngm-core-icon>
      </ngm-core-button>

      <span class="title">${this.title}</span>

      <div class="suffix">
        ${this.label == null
          ? ''
          : html`
              <span
                class="label ${classMap({
                  'is-active': this.isBackgroundActive,
                })}"
                role="button"
                data-cy="background"
                @click="${this.toggleBackgroundActive}"
                >${this.label}</span
              >
            `}

        <ngm-core-button
          transparent
          variant="secondary"
          shape="chip"
          class="opacity-toggle"
          ?active="${this.isOpacityActive}"
          ?disabled="${!this.isVisible}"
          data-cy="opacity"
          @click="${this.toggleOpacityActive}"
        >
          ${Math.round(this.opacity * 100)}%
        </ngm-core-button>
        ${tooltip(i18next.t('dtd_opacity'))}
        ${this.layer == null ? '' : this.renderActions()}
      </div>
    </div>
    ${this.isOpacityActive ? this.renderOpacity() : ''}
    ${this.isBackgroundActive ? this.renderBackground() : ''}
  `;

  readonly renderDragHandle = () => html`
    <div class="handle">
      <ngm-core-button variant="tertiary" shape="icon">
        <ngm-core-icon icon="grab"></ngm-core-icon>
      </ngm-core-button>
    </div>
  `;

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
      <ngm-core-dropdown-item role="button" @click="${this.zoomToLayer}">
        <ngm-core-icon icon="zoomPlus"></ngm-core-icon>
        ${i18next.t('dtd_zoom_to')}
      </ngm-core-dropdown-item>
      ${this.geocatUrl == null
        ? ''
        : html`
            <ngm-core-dropdown-item role="link">
              <a href="${this.geocatUrl}" target="_blank" rel="noopener">
                <ngm-core-icon icon="geocat"></ngm-core-icon>
                Geocat
              </a>
            </ngm-core-dropdown-item>
          `}
      ${this.layer?.legend == null
        ? ''
        : html`
            <ngm-core-dropdown-item role="button" @click="${this.openLegend}">
              <ngm-core-icon icon="legend"></ngm-core-icon>
              ${i18next.t('catalog:display.legend')}
            </ngm-core-dropdown-item>
          `}
      ${this.layer?.downloadUrl == null
        ? ''
        : html`
            <ngm-core-dropdown-item role="link">
              <a
                href="${this.layer.downloadUrl}"
                target="_blank"
                rel="external noopener"
              >
                <ngm-core-icon icon="download"></ngm-core-icon>
                ${i18next.t('dtd_download_hint')}
              </a>
            </ngm-core-dropdown-item>
          `}
      ${this.layer?.type === LayerType.voxels3dtiles
        ? html`
            <ngm-core-dropdown-item
              role="button"
              @click="${this.openVoxelFilter}"
            >
              <ngm-core-icon icon="filter"></ngm-core-icon>
              ${i18next.t('dtd_voxel_filter')}
            </ngm-core-dropdown-item>
          `
        : ''}
      ${this.layer?.type === LayerType.geoTIFF
        ? html`
            <ngm-core-dropdown-item
              role="button"
              @click="${this.openTiffFilter}"
            >
              <ngm-core-icon icon="filter"></ngm-core-icon>
              ${i18next.t('layers:geoTIFF.bandsWindow.open')}
            </ngm-core-dropdown-item>
          `
        : ''}
      ${this.layer?.wmtsTimes == null || this.layer.wmtsTimes.length === 1
        ? ''
        : html`
            <ngm-core-dropdown-item
              role="button"
              @click="${this.openWmtsDatePicker}"
            >
              <ngm-core-icon icon="turnPage"></ngm-core-icon>
              ${i18next.t('dtd_time_journey')}
            </ngm-core-dropdown-item>
          `}
      <ngm-core-dropdown-item role="button" @click="${this.removeLayer}">
        <ngm-core-icon icon="trash"></ngm-core-icon>
        ${i18next.t('dtd_remove')}
      </ngm-core-dropdown-item>
    `)}
  `;

  private readonly renderOpacity = () => html`
    <hr />
    <div class="opacity">
      <ngm-core-slider
        .value="${this.opacity}"
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

    :host([draggable]) {
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

    /* title */

    .title {
      ${applyTypography('body-2')};
      flex-grow: 1;

      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* label */
    /* TODO this style is improvised, as the Figma interaction for this label has not yet been finalized. */

    .label {
      ${applyTypography('overline')};

      display: flex;
      align-items: center;
      padding: 10px;
      height: 27px;
      border-radius: 22px;
      cursor: pointer;

      color: var(--color-text--emphasis-high);
      background-color: var(--color-bg--grey);

      ${applyTransition('fade')};
      transition-property: background-color;
    }

    .label:hover {
      background-color: var(--color-green-disabled);
    }

    .label.is-active {
      color: var(--color-text--emphasis-medium);
      background-color: var(--color-secondary--active);
      border-color: var(--color-secondary--active);
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

export type VisibilityChangeEvent = CustomEvent<VisibilityChangeEventDetail>;

export interface VisibilityChangeEventDetail {
  isVisible: boolean;
}

export type OpacityChangeEvent = CustomEvent<OpacityChangeEventDetail>;

export interface OpacityChangeEventDetail {
  opacity: number;
}

const GEOCAT_LANGUAGE_MAPPING = {
  de: 'ger',
  fr: 'fre',
  it: 'ita',
  en: 'eng',
};
