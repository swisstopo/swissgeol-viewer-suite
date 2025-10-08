import { consume } from '@lit/context';
import { customElement, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { LayerService } from 'src/features/layer/new/layer.service';
import { Layer } from 'src/features/layer';
import { Id } from '@swissgeol/ui-core';
import { css, html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { identity } from 'rxjs';

@customElement('ngm-catalog-display-list')
export class CatalogDisplayList extends CoreElement {
  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  @state()
  accessor activeLayerIds: ReadonlyArray<Id<Layer>> = [];

  connectedCallback() {
    super.connectedCallback();

    this.layerService.activeLayerIds$.subscribe((ids) => {
      this.activeLayerIds = ids;
    });
  }

  readonly render = () => html`
    <ul>
      ${repeat(
        this.activeLayerIds,
        identity,
        (id) => html`
          <li>
            <ngm-catalog-display-list-item
              .layerId="${id}"
            ></ngm-catalog-display-list-item>
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

    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 12px;
      border-radius: 4px;
      background-color: var(--color-bg--white);
    }

    ul {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 0;
      margin: 0;
      list-style: none;
    }

    hr {
      height: 1px;
      border: 0;
      margin: 0 12px;
      color: var(--color-border--default);
      background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' stroke='%23DFE4E9' stroke-width='4' stroke-dasharray='3%2c 12' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e");
    }
  `;
}
