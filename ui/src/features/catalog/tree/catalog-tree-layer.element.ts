import { consume } from '@lit/context';
import { customElement, property, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { LayerService } from 'src/features/layer/layer.service';
import { getLayerLabel, is3dLayer, Layer } from 'src/features/layer';
import { Id } from 'src/models/id.model';
import { css, html } from 'lit';
import { when } from 'lit/directives/when.js';

@customElement('ngm-catalog-tree-layer')
export class CatalogTreeLayer extends CoreElement {
  @property()
  accessor layerId!: Id<Layer>;

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  @state()
  accessor isActive = false;

  @state()
  accessor layer!: Layer;

  connectedCallback() {
    super.connectedCallback();
    this.initializeById();

    this.addEventListener('click', this.toggle);
  }

  updated() {
    this.title = this.label;
  }

  get label() {
    return getLayerLabel(this.layer);
  }

  private initializeById() {
    this.register(
      this.layerService.isLayerActive$(this.layerId).subscribe((isActive) => {
        this.isActive = isActive;
      }),
    );

    this.register(
      this.layerService.layer$(this.layerId).subscribe((layer) => {
        this.layer = layer;
      }),
    );
  }

  private readonly toggle = () => {
    if (this.isActive) {
      this.layerService.deactivate(this.layerId);
    } else {
      this.layerService.activate(this.layerId);
    }
  };

  readonly render = () => html`
    <ngm-core-icon icon="layerIndicator"></ngm-core-icon>
    <ngm-core-checkbox
      .isActive="${this.isActive}"
      @update="${this.toggle}"
    ></ngm-core-checkbox>
    <label>${this.label}</label>
    ${when(
      this.layer !== undefined && is3dLayer(this.layer),
      () => html`<ngm-core-chip>3D</ngm-core-chip>`,
    )}
  `;

  static readonly styles = css`
    :host {
      display: flex;
      gap: 10px;
      align-items: center;
      height: 30px;
      min-width: 0;
      cursor: pointer;
    }

    ngm-core-icon {
      height: 12px;
      width: 12px;
      min-width: 12px;
      max-width: 12px;
      align-self: start;
      margin-top: 4px;
    }

    label {
      flex: 0 1 auto;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
    }

    ngm-core-chip {
      flex-shrink: 0;
    }
  `;
}
