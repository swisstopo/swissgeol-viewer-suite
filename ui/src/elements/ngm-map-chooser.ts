import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { BackgroundLayerService } from 'src/features/background/background-layer.service';
import { BackgroundLayer } from 'src/features/layer/layer.model';
import 'src/features/background/background.module';

@customElement('ngm-map-chooser')
export class NgmMapChooser extends LitElement {
  @consume({
    context: BackgroundLayerService.backgroundContext,
    subscribe: true,
  })
  accessor background!: BackgroundLayer;

  @property({ type: Boolean })
  accessor initiallyOpened = true;

  @state()
  accessor open = true;

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
        .layer="${this.background}"
        size="large"
      ></ngm-background-layer-item>
    </div>
  `;
}
