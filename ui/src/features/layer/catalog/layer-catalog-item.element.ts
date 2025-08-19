import { customElement, property } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { LayerConfig } from 'src/layertree';
import { css, html } from 'lit';
import i18next from 'i18next';
import { LayerService } from 'src/features/layer/layer.service';
import { consume } from '@lit/context';

@customElement('ngm-layer-catalog-item')
export class LayerCatalogItem extends CoreElement {
  @property() accessor layer!: LayerConfig;

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  connectedCallback() {
    super.connectedCallback();

    let isActive: boolean | null = null;
    this.register(
      this.layerService.activeLayers$.subscribe(() => {
        if (this.layer.displayed !== isActive) {
          isActive = this.layer.displayed ?? null;
          this.requestUpdate();
        }
      }),
    );
  }

  private toggleLayer(layer: LayerConfig): void {
    this.layerService.toggle(layer);
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
