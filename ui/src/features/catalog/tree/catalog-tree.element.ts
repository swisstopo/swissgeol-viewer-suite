import { consume } from '@lit/context';
import { customElement, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { LayerService } from 'src/features/layer/layer.service';
import { LayerGroup } from 'src/features/layer';
import { Id } from '@swissgeol/ui-core';
import { css, html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { identity } from 'rxjs';

@customElement('ngm-catalog-tree')
export class CatalogTree extends CoreElement {
  @state()
  accessor rootGroupIds: ReadonlyArray<Id<LayerGroup>> = [];

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  connectedCallback() {
    super.connectedCallback();

    this.register(
      this.layerService.rootGroupIds$.subscribe((rootGroupIds) => {
        this.rootGroupIds = rootGroupIds;
      }),
    );
  }

  readonly render = () => html`
    <ul>
      ${repeat(
        this.rootGroupIds,
        identity,
        (id) => html`
          <li>
            <ngm-catalog-tree-group
              .groupId="${id}"
              .isTopLevel="${true}"
            ></ngm-catalog-tree-group>
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
      list-style: none;
      margin: 0;
      padding: 0;

      display: flex;
      flex-direction: column;
      gap: 6px;
    }
  `;
}
