import { consume } from '@lit/context';
import { customElement, property, state } from 'lit/decorators.js';
import {
  CoreElement,
  CoreWindow,
  CoreWindowProps,
  dropdown,
  tooltip,
} from 'src/features/core';
import { LayerService } from 'src/features/layer/new/layer.service';
import { getLayerLabel, Layer, LayerType } from 'src/features/layer';
import { css, html } from 'lit';
import { Id } from 'src/models/id.model';
import i18next from 'i18next';
import { applyTransition, applyTypography } from 'src/styles/theme';
import { when } from 'lit/directives/when.js';
import { SliderChangeEvent } from 'src/features/core/core-slider.element';
import { throttle } from 'src/utils/fn.utils';

@customElement('ngm-catalog-display-list-item')
export class CatalogDisplayList extends CoreElement {
  @property({ reflect: true, attribute: 'layer-id' })
  accessor layerId!: Id<Layer>;

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  @state()
  accessor layer!: Layer;

  @state()
  accessor isOpacityActive = false;

  @state()
  accessor isBackgroundActive = false;

  private readonly windows = {
    legend: null as CoreWindow | null,
    times: null as CoreWindow | null,
    tiffFilter: null as CoreWindow | null,
  } satisfies Record<string, unknown>;

  connectedCallback() {
    super.connectedCallback();

    this.register(
      this.layerService.layer$(this.layerId).subscribe((layer) => {
        this.setAttribute('visible', `${layer.isVisible}`);
        this.layer = layer;
      }),
    );

    this.register(() => {
      for (const window of Object.values(this.windows)) {
        window?.close();
      }
    });
  }

  updated() {
    this.toggleAttribute(
      'draggable',
      !(this.isOpacityActive || this.isBackgroundActive),
    );
  }

  private readonly toggleVisibility = (): void => {
    if (this.layer.isVisible) {
      this.isOpacityActive = false;
    }
    this.layerService.update(this.layerId, {
      isVisible: !this.layer.isVisible,
    });
  };

  private readonly toggleOpacityActive = (): void => {
    this.isBackgroundActive = false;
    this.isOpacityActive = !this.isOpacityActive;
    this.classList.toggle('has-active-opacity', this.isOpacityActive);
  };

  private readonly zoomToLayer = async (): Promise<void> => {
    this.layerService.controller(this.layer.id)?.zoomIntoView();
  };

  private readonly removeLayer = (): void => {
    this.layerService.deactivate(this.layer.id);
  };

  private readonly openVoxelFilter = (): void => {
    this.dispatchEvent(
      new CustomEvent('showVoxelFilter', {
        composed: true,
        bubbles: true,
        detail: {
          config: this.layer,
        },
      }),
    );
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
      },
    });
  }

  private readonly openLegend = (): void =>
    this.openWindow('legend', {
      title: () => getLayerLabel(this.layer),
      body: () => html`
        <ngm-catalog-display-legend
          .layerId=${this.layer.id}
        ></ngm-catalog-display-legend>
      `,
    });

  private readonly openTimes = (): void =>
    this.openWindow('times', {
      title: () => getLayerLabel(this.layer),
      body: () => html`
        <ngm-catalog-display-times
          .layerId=${this.layer.id}
        ></ngm-catalog-display-times>
      `,
    });

  private readonly openTiffFilter = (): void =>
    this.openWindow('tiffFilter', {
      title: () => getLayerLabel(this.layer),
      body: () => html`
        <ngm-layer-tiff-bands .layer="${this.layer}"></ngm-layer-tiff-bands>
      `,
    });

  private readonly handleOpacityChangeEvent = throttle(
    (event: SliderChangeEvent): void => {
      this.layerService.update(this.layerId, { opacity: event.detail.value });
    },
    50,
  );

  readonly render = () => html`
    <div class="main">
      <ngm-core-button
        transparent
        variant="tertiary"
        shape="icon"
        data-cy="visibility"
        @click="${this.toggleVisibility}"
      >
        <ngm-core-icon
          icon="${this.layer.isVisible ? 'visible' : 'hidden'}"
        ></ngm-core-icon>
      </ngm-core-button>

      <span class="title">${getLayerLabel(this.layer)}</span>

      <div class="suffix">
        <ngm-core-button
          transparent
          variant="secondary"
          shape="chip"
          class="opacity-toggle"
          ?active="${this.isOpacityActive}"
          ?disabled="${!this.layer.isVisible}"
          data-cy="opacity"
          @click="${this.toggleOpacityActive}"
        >
          ${Math.round(this.layer.opacity * 100)}%
        </ngm-core-button>
        ${tooltip(i18next.t('catalog:display.opacity'))}
        ${this.layer == null ? '' : this.renderActions()}
      </div>
    </div>
    ${this.isOpacityActive ? this.renderOpacity() : ''}
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
      ${when(
        this.layer.geocatId !== null,
        () => html`
          <ngm-core-dropdown-item role="link">
            <a
              href="${i18next.t('layers:geocatUrl', {
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
        this.layer.legend !== null,
        () => html`
          <ngm-core-dropdown-item role="button" @click="${this.openLegend}">
            <ngm-core-icon icon="legend"></ngm-core-icon>
            ${i18next.t('catalog:display.legend')}
          </ngm-core-dropdown-item>
        `,
      )}
      ${when(
        this.layer.downloadUrl !== null,
        () => html`
          <ngm-core-dropdown-item role="link">
            <a
              href="${this.layer.downloadUrl}"
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
      ${this.layer.type === LayerType.Tiff
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
      ${when(
        this.layer.type === LayerType.Swisstopo && this.layer.times !== null,
        () => html`
          <ngm-core-dropdown-item role="button" @click="${this.openTimes}">
            <ngm-core-icon icon="turnPage"></ngm-core-icon>
            ${i18next.t('catalog:display.timeTravel')}
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
      cursor: grab;

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
