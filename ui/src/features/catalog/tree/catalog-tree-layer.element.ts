import { consume } from '@lit/context';
import { customElement, property, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { LayerService } from 'src/features/layer/new/layer.service';
import { Layer } from 'src/features/layer';
import { Id } from 'src/models/id.model';
import { css, html } from 'lit';
import i18next from 'i18next';

@customElement('ngm-catalog-tree-layer')
export class CatalogTreeLayer extends CoreElement {
  @property()
  accessor layerId!: Id<Layer>;

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  @state()
  accessor isActive = false;

  connectedCallback() {
    super.connectedCallback();
    this.initializeById();

    this.addEventListener('click', this.toggle);
  }

  updated() {
    this.title = this.label;
  }

  private initializeById() {
    this.register(
      this.layerService.isLayerActive$(this.layerId).subscribe((isActive) => {
        this.isActive = isActive;
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

  private get label(): string {
    return i18next.t(`layers:layers.${this.layerId}`);
  }

  readonly render = () => html`
    <ngm-core-icon icon="layerIndicator"></ngm-core-icon>
    <ngm-core-checkbox
      .isActive="${this.isActive}"
      @update="${this.toggle}"
    ></ngm-core-checkbox>
    <label>${this.label}</label>
  `;

  static readonly styles = css`
    :host {
      display: flex;
      gap: 10px;
      align-items: center;
      height: 30px;
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
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
    }
  `;
}
