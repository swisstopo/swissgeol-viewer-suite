import { consume } from '@lit/context';
import { customElement, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { LayerService } from 'src/features/layer/layer.service';
import { BACKGROUND_LAYER, Layer } from 'src/features/layer';
import { Id } from '@swissgeol/ui-core';
import { css, html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { keyed } from 'lit/directives/keyed.js';
import { identity } from 'rxjs';
import { language$ } from 'src/i18n';
import Sortable from 'sortablejs';
import { when } from 'lit/directives/when.js';

@customElement('ngm-catalog-display-list')
export class CatalogDisplayList extends CoreElement {
  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  @state()
  accessor activeLayerIds: ReadonlyArray<Id<Layer>> = [];

  private sortable!: Sortable;

  private haveLayersChanged = false;

  /**
   * A key that, when changed, forces the current item elements to be discarded and recreated.
   *
   * This key is incremented whenever a render is triggered while {@link haveLayersChanged} is `true`.
   *
   * @private
   */
  private renderKey = 0;

  connectedCallback(): void {
    super.connectedCallback();

    this.layerService.activeLayerIds$.subscribe((ids) => {
      this.activeLayerIds = ids;
      this.haveLayersChanged = true;
    });

    this.register(language$.subscribe(() => this.initializeDragging()));

    this.register(() => this.sortable?.destroy());
  }

  firstUpdated(): void {
    this.initializeDragging();
  }

  willUpdate(): void {
    if (this.haveLayersChanged) {
      // Force an item renewal as adding/removing/sorting layers can disconnect Lit from their elements.
      this.renderKey += 1;
    }
  }

  updated(): void {
    if (this.haveLayersChanged) {
      this.haveLayersChanged = false;
      this.removeRemnantItems();
      setTimeout(() => {
        this.initializeDragging();
      });
    }
  }

  private initializeDragging(): void {
    const listElement = this.shadowRoot!.querySelector('ul');
    if (listElement == null) {
      return;
    }

    this.sortable?.destroy();
    this.sortable = Sortable.create(listElement, {
      animation: 150,
      forceFallback: false,
      group: { pull: true, put: true, name: 'default' },
      draggable: 'li',
      filter: 'li:has(ngm-catalog-display-list-item:not([sortable]))',
      onChoose: (event) => {
        if (event.item) {
          event.item.children[0].classList.add('is-dragged');
        }
      },
      onUnchoose: (event) => {
        if (event.item) {
          event.item.children[0].classList.remove('is-dragged');
        }
      },
      onStart: () => {
        for (const child of listElement.children) {
          child.children[0].classList.add('is-in-drag');
        }
      },
      onEnd: (event) => {
        for (const child of listElement.children) {
          child.children[0].classList.remove('is-in-drag');
        }
        if (event.item) {
          event.item.blur();
        }
      },
      onUpdate: (e) => this.reorderLayer(e.oldIndex!, e.newIndex!),
    });
  }

  /**
   * When sorting layers via Sortable.js, Lit will lose connection to any elements that have been dragged.
   *
   * We fix this by completely redrawing the layers after sorting.
   * However, this can cause items to be listed multiple times,
   * as Lit doesn't recognize that the old item has to be removed.
   *
   * The solution to this is to iterate all items and remove any duplicates.
   * Note that Lit will always render its items at the top of the list,
   * so we can safely remove any duplicates after the first entry.
   *
   * @private
   */
  private removeRemnantItems(): void {
    const listElement = this.shadowRoot!.querySelector('ul');
    if (listElement == null) {
      return;
    }

    const knownIds = new Set();
    for (const element of listElement.children) {
      const id = (element as HTMLElement).dataset.id!;
      if (knownIds.has(id)) {
        element.remove();
      } else {
        knownIds.add(id);
      }
    }
  }

  private reorderLayer(oldIndex: number, newIndex: number): void {
    const layerId = this.layerService.activeLayerIds[oldIndex];
    this.layerService.move(layerId, newIndex - oldIndex);
  }

  readonly render = () => html`
    ${when(
      this.activeLayerIds.length !== 0,
      () => html`
        <ul>
          ${keyed(
            this.renderKey,
            repeat(
              this.activeLayerIds,
              identity,
              (id) => html`
                <li data-id="${id}">
                  <ngm-catalog-display-list-item
                    .layerId="${id}"
                    data-cy="${id}"
                  ></ngm-catalog-display-list-item>
                </li>
              `,
            ),
          )}
        </ul>
        <hr />
      `,
    )}
    <ngm-catalog-display-list-item
      .layerId="${BACKGROUND_LAYER.id}"
      data-cy="${BACKGROUND_LAYER.id}"
    ></ngm-catalog-display-list-item>
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
