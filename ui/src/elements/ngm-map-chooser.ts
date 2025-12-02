import { html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { consume } from '@lit/context';

import {
  BACKGROUND_LAYER,
  BackgroundLayer,
  LayerService,
} from 'src/features/layer';
import { CoreElement } from 'src/features/core';

@customElement('ngm-map-chooser')
export class NgmMapChooser extends CoreElement {
  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  @state()
  accessor background!: BackgroundLayer;

  @property({ type: Boolean })
  accessor initiallyOpened = true;

  @state()
  accessor open = true;

  connectedCallback() {
    super.connectedCallback();

    this.register(
      this.layerService.layer$(BACKGROUND_LAYER.id).subscribe((layer) => {
        this.background = layer;
      }),
    );
  }

  protected firstUpdated() {
    setTimeout(() => {
      this.open = this.initiallyOpened;
    });
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }

  readonly render = () => html`
    <div class="ngm-maps-container" ?hidden=${!this.open}>
      <ngm-background-layer-select></ngm-background-layer-select>
      <div class="ngm-close-icon" @click=${() => (this.open = false)}></div>
    </div>
    <div
      class="ngm-selected-map-container"
      .hidden=${this.open}
      @click=${() => (this.open = true)}
    >
      <ngm-background-layer-item
        .variant="${this.background.variants.get(
          this.background.activeVariantId,
        )}"
        size="large"
      ></ngm-background-layer-item>
    </div>
  `;
}
