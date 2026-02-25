import { css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { Tiles3dLayer, Tiles3dLayerController } from 'src/features/layer';
import { consume } from '@lit/context';
import { LayerService } from 'src/features/layer/layer.service';
import { Id } from 'src/models/id.model';
import { SliderChangeEvent } from 'src/features/core/core-slider.element';
import { throttle } from 'src/utils/fn.utils';
import { applyTypography } from 'src/styles/theme';
import i18next from 'i18next';

@customElement('ngm-catalog-display-slice-detail')
export class CatalogDisplaySliceDetail extends CoreElement {
  @property()
  accessor layerId!: Id<Tiles3dLayer>;

  @state()
  accessor layer!: Tiles3dLayer;

  @state()
  accessor sliceIndices: [number, number, number] = [0, 0, 0];

  @state()
  accessor controller: Tiles3dLayerController | null = null;

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  connectedCallback(): void {
    super.connectedCallback();

    this.register(
      this.layerService.layer$(this.layerId).subscribe((layer) => {
        this.layer = layer;

        // Get and store controller
        this.controller = this.layerService.controller(
          layer.id,
        ) as Tiles3dLayerController;

        // Initialize slice indices
        if (this.controller?.supportsSliceSelection) {
          this.sliceIndices = this.controller.getCurrentSliceIndices();
        }
      }),
    );
  }

  private readonly handleAufschnitteChange = throttle(
    (event: SliderChangeEvent): void => {
      if (!this.controller) return;

      const index = Math.round(event.detail.value);
      this.sliceIndices = [index, this.sliceIndices[1], this.sliceIndices[2]];
      this.controller.updateSliceAtIndex(0, index);
    },
    500,
  );

  private readonly handleSeitenansichtenChange = throttle(
    (event: SliderChangeEvent): void => {
      if (!this.controller) return;

      const index = Math.round(event.detail.value);
      this.sliceIndices = [this.sliceIndices[0], index, this.sliceIndices[2]];
      this.controller.updateSliceAtIndex(1, index);
    },
    500,
  );

  private readonly handleQuerschnitteChange = throttle(
    (event: SliderChangeEvent): void => {
      if (!this.controller) return;

      const index = Math.round(event.detail.value);
      this.sliceIndices = [this.sliceIndices[0], this.sliceIndices[1], index];
      this.controller.updateSliceAtIndex(2, index);
    },
    500,
  );

  readonly render = () => {
    if (!this.controller || !this.controller.supportsSliceSelection) {
      return html``;
    }

    const availableSlices = this.controller.getAvailableSlices();
    if (availableSlices.length === 0) {
      return html``;
    }

    const ranges = this.controller.getSliceRanges();

    // Calculate current slice numbers for each category
    const aufschnitteSlice =
      availableSlices[ranges[0].start + this.sliceIndices[0]] ?? 0;
    const seitenansichtenSlice =
      availableSlices[ranges[1].start + this.sliceIndices[1]] ?? 0;
    const querschnitteSlice =
      availableSlices[ranges[2].start + this.sliceIndices[2]] ?? 0;

    return html`
      <div class="slice-control">
        <!-- Aufschnitte Slider -->
        <div class="slice-category">
          <div class="slice-info">
            <span class="slice-label">
              ${i18next.t('catalog:slice_window.aufschnitte', {
                defaultValue: 'Aufschnitte',
              })}
            </span>
            <span class="slice-value">${aufschnitteSlice}</span>
          </div>
          <ngm-core-slider
            .value="${this.sliceIndices[0]}"
            .min="${0}"
            .max="${ranges[0].end - ranges[0].start}"
            .step="${1}"
            @change="${this.handleAufschnitteChange}"
          ></ngm-core-slider>
        </div>

        <!-- Seitenansichten Slider -->
        <div class="slice-category">
          <div class="slice-info">
            <span class="slice-label">
              ${i18next.t('catalog:slice_window.seitenansichten', {
                defaultValue: 'Seitenansichten',
              })}
            </span>
            <span class="slice-value">${seitenansichtenSlice}</span>
          </div>
          <ngm-core-slider
            .value="${this.sliceIndices[1]}"
            .min="${0}"
            .max="${ranges[1].end - ranges[1].start}"
            .step="${1}"
            @change="${this.handleSeitenansichtenChange}"
          ></ngm-core-slider>
        </div>

        <!-- Querschnitte Slider -->
        <div class="slice-category">
          <div class="slice-info">
            <span class="slice-label">
              ${i18next.t('catalog:slice_window.querschnitte', {
                defaultValue: 'Querschnitte',
              })}
            </span>
            <span class="slice-value">${querschnitteSlice}</span>
          </div>
          <ngm-core-slider
            .value="${this.sliceIndices[2]}"
            .min="${0}"
            .max="${ranges[2].end - ranges[2].start}"
            .step="${1}"
            @change="${this.handleQuerschnitteChange}"
          ></ngm-core-slider>
        </div>

        <!-- Overall Range Info -->
        <div class="slice-range">
          <span class="range-label">
            ${i18next.t('catalog:slice_window.total_range', {
              defaultValue: 'Gesamtbereich',
            })}:
          </span>
          <span class="range-value">
            ${availableSlices[0]} -
            ${availableSlices[availableSlices.length - 1]}
          </span>
        </div>
      </div>
    `;
  };

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      padding: 16px;
    }

    .slice-control {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .slice-category {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      border-radius: 4px;
      background-color: var(
        --color-background--emphasis-low,
        rgba(0, 0, 0, 0.02)
      );
    }

    .slice-info,
    .slice-range {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .slice-label,
    .range-label {
      ${applyTypography('body-2')};
      color: var(--color-text--emphasis-medium);
    }

    .slice-value {
      ${applyTypography('h5')};
      color: var(--color-text--emphasis-high);
      font-weight: 600;
    }

    .range-value {
      ${applyTypography('body-2')};
      color: var(--color-text--emphasis-high);
    }

    .slice-range {
      padding-top: 8px;
      border-top: 1px solid
        var(--color-border--emphasis-low, rgba(0, 0, 0, 0.1));
    }
  `;
}
