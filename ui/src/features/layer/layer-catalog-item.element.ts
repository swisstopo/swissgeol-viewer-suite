import { customElement, property } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { LayerConfig } from 'src/layertree';
import { css, html } from 'lit';
import i18next from 'i18next';
import { LayerEventDetail } from 'src/features/layer/layer-event.model';

@customElement('ngm-layer-catalog-item')
export class LayerCatalogItem extends CoreElement {
  @property() accessor layer!: LayerConfig;

  connectedCallback() {
    super.connectedCallback();

    let isActive: boolean | null = null;
    const interval = setInterval(() => {
      if (this.layer.displayed !== isActive) {
        isActive = this.layer.displayed ?? null;
        this.requestUpdate();
      }
    }, 1000);
    this.register(() => clearInterval(interval));
  }

  private toggleLayer(layer: LayerConfig): void {
    this.dispatchEvent(
      new CustomEvent<LayerEventDetail>('layer-click', {
        composed: true,
        bubbles: true,
        detail: {
          layer,
        },
      }),
    );
    this.requestUpdate();
  }

  render() {
    return html`
      <div class="layer">
        <ngm-core-icon icon="layerIndicator"></ngm-core-icon>
        <ngm-core-checkbox
          .isActive="${this.layer.displayed}"
          @update="${() => this.toggleLayer(this.layer)}"
        ></ngm-core-checkbox>
        <label>${i18next.t(this.layer.label)}</label>
      </div>
    `;
  }

  static readonly styles = css`
    .layer {
      display: flex;
      gap: 10px;
      align-items: center;
      height: 30px;

      ngm-core-icon {
        height: 12px;
        width: 12px;
        align-self: start;
        margin-top: 4px;
      }
    }
  `;
}
