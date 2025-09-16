import { customElement, property, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { type LayerTreeNode } from 'src/layertree';
import { css, html, TemplateResult } from 'lit';
import i18next from 'i18next';
import { repeat } from 'lit/directives/repeat.js';
import { getCategoryOrLayerTemplate } from 'src/features/layer/catalog/layer-catalog.element';
import { SessionService } from 'src/features/session';
import { consume } from '@lit/context';

@customElement('ngm-layer-catalog-category')
export class LayerCatalogCategory extends CoreElement {
  @property() accessor node: LayerTreeNode | null = null;
  @property() accessor isTopLevel = false;

  @state()
  private accessor userGroups: string[] = [];

  @consume({ context: SessionService.context() })
  accessor sessionService!: SessionService;

  connectedCallback() {
    super.connectedCallback();
    this.register(
      this.sessionService.user$.subscribe((user) => {
        this.userGroups = user?.groups ?? [];
      }),
    );

    let lastNumber: number | null = null;
    const interval = setInterval(() => {
      if (this.node === null) {
        return;
      }
      const number = this.findNumberOfActiveLayersForCategory(this.node);
      if (lastNumber !== number) {
        lastNumber = number;
        this.requestUpdate();
      }
    }, 1000);
    this.register(() => clearInterval(interval));
  }

  findNumberOfActiveLayersForCategory(layer: LayerTreeNode): number {
    const children = layer.children;
    if (children == null) {
      return 0;
    }
    let active_layers = 0;
    children.forEach((child) => {
      if (child.children) {
        active_layers += this.findNumberOfActiveLayersForCategory(child);
      }
      if (child.displayed) {
        active_layers++;
      }
    });
    return active_layers;
  }

  render() {
    if (this.node == null) {
      return html``;
    }
    // if it is a restricted layer, the user must be logged in to see it
    const children = this.node.children?.filter(
      (node) =>
        !(
          node.restricted &&
          !node.restricted.some((g) => this.userGroups.includes(g))
        ),
    );
    if (children == null || children.length === 0) {
      return html``;
    }
    let header: TemplateResult;
    if (this.isTopLevel) {
      const activeLayers = this.findNumberOfActiveLayersForCategory(this.node);
      header = html`
        <div class="header-title">
          <span>${i18next.t(this.node.label)}</span>
          ${activeLayers > 0
            ? html`<ngm-core-chip>${activeLayers}</ngm-core-chip>`
            : html``}
        </div>
        <ngm-core-icon icon="dropdown"></ngm-core-icon>
      `;
    } else {
      header = html`
        <ngm-core-icon icon="dropdown"></ngm-core-icon>
        <label>${i18next.t(this.node.label)}</label>
      `;
    }
    return html`
      <ngm-core-accordion>
        <div
          slot="header"
          class="header ${this.isTopLevel ? 'is-top-level' : 'is-low-level'}"
        >
          ${header}
        </div>
        <div class="body">
          ${repeat(
            children,
            (node) => node.layer ?? node.label ?? node,
            (node) => getCategoryOrLayerTemplate(node, false),
          )}
        </div>
      </ngm-core-accordion>
    `;
  }

  static readonly styles = css`
    .header {
      background-color: var(--color-bg--white);
      color: var(--color-primary);
      display: flex;
      align-items: center;

      ngm-core-icon {
        transition: ease-in-out 250ms transform;
      }
      &:not(.active) > ngm-core-icon {
        transform: rotate(-90deg);
      }
    }

    .body {
      background-color: var(--color-bg--white);
      color: var(--color-primary);
    }

    .header.is-top-level {
      justify-content: space-between;
      padding: 12px 16px;
      border-radius: 4px;

      .header-title {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      &.active {
        border-bottom: 2px solid var(--color-bg--grey);
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
      }
    }

    .header.is-top-level + .body {
      padding: 16px;
      border-bottom-left-radius: 4px;
      border-bottom-right-radius: 4px;
    }

    .header.is-low-level {
      padding: 8px 0;
    }

    .header.is-low-level + .body {
      padding-left: 12px;
      padding-top: 0;
    }
  `;
}
