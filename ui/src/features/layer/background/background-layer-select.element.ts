import { customElement, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { consume } from '@lit/context';
import { css, html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { applyTransition } from 'src/styles/theme';
import { LayerService } from 'src/features/layer/layer.service';
import { BACKGROUND_LAYER, BackgroundLayerVariant } from 'src/features/layer';
import { Id } from 'src/models/id.model';
import { BackgroundLayer } from 'src/features/layer/models';

@customElement('ngm-background-layer-select')
export class BackgroundLayerSelect extends CoreElement {
  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  @state()
  accessor background!: BackgroundLayer;

  connectedCallback() {
    super.connectedCallback();

    this.register(
      this.layerService.layer$(BACKGROUND_LAYER.id).subscribe((layer) => {
        this.background = layer;
      }),
    );
  }

  private selectVariant(id: Id<BackgroundLayerVariant>): void {
    this.layerService.update(this.background.id, { activeVariantId: id });
  }

  readonly render = () => html`
    <ul>
      ${repeat(
        this.background?.variants.values() ?? [],
        (variant) => variant.id,
        (variant) => html`
          <li role="button" @click="${() => this.selectVariant(variant.id)}">
            <ngm-background-layer-item
              .variant="${variant}"
              .isActive="${variant.id === this.background.activeVariantId}"
              data-cy="${variant.id}"
            ></ngm-background-layer-item>
          </li>
        `,
      )}
    </ul>
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    ul {
      display: flex;
      list-style: none;
      margin: 0;
      padding: 0;
      gap: 12px;
    }

    ul > li {
      padding: 0;
      margin: 0;
      width: 42px;
      height: 42px;
      cursor: pointer;

      ${applyTransition('fade')};
      transition-property: opacity;
    }

    ul > li:hover {
      opacity: 0.75;
    }
  `;
}
