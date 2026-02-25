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
  accessor currentSliceIndex = 0;

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

        // Initialize slice index
        if (this.controller?.supportsSliceSelection) {
          const availableSlices = this.controller.getAvailableSlices();
          this.currentSliceIndex = Math.floor(availableSlices.length / 2);
        }
      }),
    );
  }

  private readonly handleSliceChangeEvent = throttle(
    (event: SliderChangeEvent): void => {
      if (!this.controller) {
        return;
      }

      const availableSlices = this.controller.getAvailableSlices();
      const index = Math.round(event.detail.value);
      this.currentSliceIndex = index;

      if (availableSlices.length > 0 && index < availableSlices.length) {
        const sliceNumber = availableSlices[index];
        this.controller.updateSlices([sliceNumber]);
      }
    },
    200,
  );

  readonly render = () => {
    if (!this.controller || !this.controller.supportsSliceSelection) {
      return html``;
    }

    const availableSlices = this.controller.getAvailableSlices();
    if (availableSlices.length === 0) {
      return html``;
    }

    const currentSlice = availableSlices[this.currentSliceIndex] ?? 0;
    const minIndex = 0;
    const maxIndex = availableSlices.length - 1;

    return html`
      <div class="slice-control">
        <div class="slice-info">
          <span class="slice-label">
            ${i18next.t('catalog:slice_window.current_slice', {
              defaultValue: 'Current Slice',
            })}:
          </span>
          <span class="slice-value">${currentSlice}</span>
        </div>
        <div class="slice-range">
          <span class="range-label">
            ${i18next.t('catalog:slice_window.range', {
              defaultValue: 'Range',
            })}:
          </span>
          <span class="range-value">
            ${availableSlices[0]} -
            ${availableSlices[availableSlices.length - 1]}
          </span>
        </div>
        <ngm-core-slider
          .value="${this.currentSliceIndex}"
          .min="${minIndex}"
          .max="${maxIndex}"
          .step="${1}"
          @change="${this.handleSliceChangeEvent}"
        ></ngm-core-slider>
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
      gap: 16px;
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
  `;
}
