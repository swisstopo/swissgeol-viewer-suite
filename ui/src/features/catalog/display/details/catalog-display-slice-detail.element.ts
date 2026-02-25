import { css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import {
  Tiles3dLayer,
  Tiles3dLayerController,
  SliceIndices,
} from 'src/features/layer';
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
  accessor sliceIndices: SliceIndices = {
    inline: 0,
    crossline: 0,
    depth: 0,
  };

  @state()
  accessor controller: Tiles3dLayerController | null = null;

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  connectedCallback(): void {
    super.connectedCallback();

    this.register(
      this.layerService.layer$(this.layerId).subscribe((layer) => {
        this.layer = layer;

        this.controller = this.layerService.controller(
          layer.id,
        ) as Tiles3dLayerController;

        if (this.controller?.supportsSliceSelection) {
          this.sliceIndices = this.controller.getCurrentSliceIndices();
        }
      }),
    );
  }

  private readonly handleSliceChange = (key: keyof SliceIndices) =>
    throttle((event: SliderChangeEvent): void => {
      if (!this.controller) return;

      const index = Math.round(event.detail.value);
      this.sliceIndices = {
        ...this.sliceIndices,
        [key]: index,
      };
      this.controller.updateSliceAtIndex(key, index);
    }, 500);

  readonly render = () => {
    if (!this.controller || !this.controller.supportsSliceSelection) {
      return html``;
    }

    const availableSlices = this.controller.getAvailableSlices();
    if (availableSlices.length === 0) {
      return html``;
    }

    const ranges = this.controller.getSliceRanges();

    const inlineSlice =
      availableSlices[ranges.inline.start + this.sliceIndices.inline] ?? 0;
    const crosslineSlice =
      availableSlices[ranges.crossline.start + this.sliceIndices.crossline] ??
      0;
    const depthSlice =
      availableSlices[ranges.depth.start + this.sliceIndices.depth] ?? 0;

    return html`
      <div class="slice-control">
        <div class="slice-category">
          <div class="slice-info">
            <span class="slice-label">
              ${i18next.t('catalog:slice_window.aufschnitte', {
                defaultValue: 'Aufschnitte',
              })}
            </span>
            <span class="slice-value">${inlineSlice}</span>
          </div>
          <ngm-core-slider
            .value="${this.sliceIndices.inline}"
            .min="${0}"
            .max="${ranges.inline.end - ranges.inline.start}"
            .step="${1}"
            @change="${this.handleSliceChange('inline')}"
          ></ngm-core-slider>
        </div>

        <div class="slice-category">
          <div class="slice-info">
            <span class="slice-label">
              ${i18next.t('catalog:slice_window.seitenansichten', {
                defaultValue: 'Seitenansichten',
              })}
            </span>
            <span class="slice-value">${crosslineSlice}</span>
          </div>
          <ngm-core-slider
            .value="${this.sliceIndices.crossline}"
            .min="${0}"
            .max="${ranges.crossline.end - ranges.crossline.start}"
            .step="${1}"
            @change="${this.handleSliceChange('crossline')}"
          ></ngm-core-slider>
        </div>

        <div class="slice-category">
          <div class="slice-info">
            <span class="slice-label">
              ${i18next.t('catalog:slice_window.querschnitte', {
                defaultValue: 'Querschnitte',
              })}
            </span>
            <span class="slice-value">${depthSlice}</span>
          </div>
          <ngm-core-slider
            .value="${this.sliceIndices.depth}"
            .min="${0}"
            .max="${ranges.depth.end - ranges.depth.start}"
            .step="${1}"
            @change="${this.handleSliceChange('depth')}"
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
