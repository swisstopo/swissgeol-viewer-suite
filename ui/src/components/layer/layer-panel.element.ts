import { css, html } from 'lit';
import i18next from 'i18next';
import { customElement, property, query } from 'lit/decorators.js';
import { LayerConfig } from 'src/layertree';
import {
  LayerEvent,
  LayerEventDetail,
  LayersEvent,
  LayersEventDetail,
} from 'src/components/layer/layer-event.model';
import 'src/components/navigation/navigation.module';
import { CoreElement } from 'src/components/core';

@customElement('ngm-layer-panel')
export class LayerPanel extends CoreElement {
  @property()
  public accessor layers: LayerConfig[] | null = null;

  @property()
  public accessor displayLayers: LayerConfig[] | null = null;

  @query('section.layers')
  private accessor layersElement!: HTMLDivElement;

  @query('section.tabs')
  private accessor tabsElement!: HTMLDivElement;

  constructor() {
    super();

    this.close = this.close.bind(this);
    this.handleDisplayLayersUpdate = this.handleDisplayLayersUpdate.bind(this);
    this.handleDisplayLayerUpdate = this.handleDisplayLayerUpdate.bind(this);
    this.handleDisplayLayerRemoval = this.handleDisplayLayerRemoval.bind(this);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'complementary');
  }

  firstUpdated(): void {
    const observer = new ResizeObserver(() => {
      const rect = this.layersElement.getBoundingClientRect();
      this.tabsElement.style.setProperty('--layers-height', `${rect.height}px`);
    });
    observer.observe(this.layersElement);
    this.register(() => observer.disconnect());
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent('close'));
  }

  private handleDisplayLayersUpdate(e: LayersEvent): void {
    this.dispatchEvent(
      new CustomEvent<LayersEventDetail>('display-layers-update', {
        detail: e.detail,
      }),
    );
  }

  private handleDisplayLayerUpdate(e: LayerEvent): void {
    this.dispatchEvent(
      new CustomEvent<LayerEventDetail>('display-layer-update', {
        detail: e.detail,
      }),
    );
  }

  private handleDisplayLayerRemoval(e: LayerEvent): void {
    this.dispatchEvent(
      new CustomEvent<LayerEventDetail>('display-layer-removal', {
        detail: e.detail,
      }),
    );
  }

  private handleDisplayLayerClick(e: LayerEvent): void {
    this.dispatchEvent(
      new CustomEvent<LayerEventDetail>('display-layer-click', {
        detail: e.detail,
      }),
    );
  }

  readonly render = () => html`
    <ngm-navigation-panel>
      <ngm-navigation-panel-header closeable @close="${this.close}">
        ${i18next.t('dtd_displayed_data_label')}
      </ngm-navigation-panel-header>
      <div class="content">
        <section class="layers">${this.renderLayers()}</section>
        <hr />
        <section class="tabs">
          <ngm-layer-tabs .layers=${this.layers}></ngm-layer-tabs>
        </section>
      </div>
    </ngm-navigation-panel>
  `;

  private readonly renderLayers = () => html`
    <ngm-layer-display-list
      .layers=${this.displayLayers}
      @layers-update="${this.handleDisplayLayersUpdate}"
      @layer-update="${this.handleDisplayLayerUpdate}"
      @layer-removal="${this.handleDisplayLayerRemoval}"
      @layer-click="${this.handleDisplayLayerClick}"
    ></ngm-layer-display-list>
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;

      --header-height: 64px;
    }

    .content > section {
      position: relative;
      background-color: var(--color-bg--dark);
      overflow-y: auto;
    }

    .content > section.layers {
      /* Layers can take up half of the available space, minus half the space reserved by the header and padding/gap. */
      max-height: calc(50% - var(--header-height) / 2 - 16px);
    }

    .content > section.tabs {
      max-height: calc(100% - var(--header-height) - var(--layers-height, 0));
    }

    section > * {
      max-width: calc(100vw);
    }

    ngm-layer-catalog {
      display: block;
    }

    .content {
      display: flex;
      flex-direction: column;
      padding: 16px;
      gap: 16px;

      height: calc(var(--panel-height) - 64px);
    }

    .content > hr {
      height: 1px;
      margin: 0 12px;
      border: 0;
      background-color: var(--color-border--emphasis-high);
    }
  `;
}
