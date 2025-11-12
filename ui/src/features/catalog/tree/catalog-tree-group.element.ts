import { consume } from '@lit/context';
import { customElement, property, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import {
  LayerService,
  TreeNode,
  TreeNodeType,
} from 'src/features/layer/layer.service';
import { css, html } from 'lit';
import { LayerGroup } from 'src/features/layer';
import { Id } from 'src/models/id.model';
import { Subscription } from 'rxjs';
import i18next from 'i18next';
import { when } from 'lit/directives/when.js';
import { repeat } from 'lit/directives/repeat.js';

@customElement('ngm-catalog-tree-group')
export class CatalogTreeGroup extends CoreElement {
  @property()
  accessor groupId!: Id<LayerGroup>;

  @property({ type: Boolean })
  accessor isTopLevel = false;

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  @state()
  accessor nodes: readonly TreeNode[] = [];

  @state()
  accessor count: number | null = null;

  private countSubscription: Subscription | null = null;

  connectedCallback() {
    super.connectedCallback();

    this.initializeById();
    this.register(() => this.countSubscription?.unsubscribe());
  }

  private initializeById() {
    this.nodes = this.layerService.getNodesOfGroup(this.groupId);

    this.countSubscription?.unsubscribe();
    if (this.isTopLevel) {
      this.countSubscription = this.layerService
        .groupCount$(this.groupId)
        .subscribe((count) => {
          this.count = count;
        });
    } else {
      this.countSubscription = null;
    }
  }

  render() {
    if (this.nodes.length === 0) {
      // Hide empty groups.
      return;
    }

    const label = i18next.t(`layers:groups.${this.groupId}`);
    return html`
      <ngm-core-accordion>
        <div
          slot="header"
          class="header ${this.isTopLevel ? 'is-top-level' : 'is-low-level'}"
          title="${label}"
        >
          ${this.renderHeader(label)}
        </div>
        <div class="body">
          ${repeat(this.nodes, (node) => node.id, this.renderNode)}
        </div>
      </ngm-core-accordion>
    `;
  }

  private readonly renderHeader = (label: string) => {
    if (this.isTopLevel) {
      return html`
        <div class="header-title">
          <span class="label">${label}</span>
          ${when(
            this.count !== 0,
            () => html`<ngm-core-chip>${this.count}</ngm-core-chip>`,
          )}
        </div>
        <ngm-core-icon icon="dropdown"></ngm-core-icon>
      `;
    }
    return html`
      <ngm-core-icon icon="dropdown"></ngm-core-icon>
      <div class="header-title">
        <span class="label">${label}</span>
      </div>
    `;
  };

  private readonly renderNode = (node: TreeNode) => {
    switch (node.type) {
      case TreeNodeType.Group:
        return html`
          <ngm-catalog-tree-group
            .groupId="${node.id}"
            data-cy="${node.id}"
          ></ngm-catalog-tree-group>
        `;
      case TreeNodeType.Layer:
        return html`
          <ngm-catalog-tree-layer
            .layerId="${node.id}"
            data-cy="${node.id}"
          ></ngm-catalog-tree-layer>
        `;
    }
  };

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

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

    .header-title {
      max-width: calc(100% - 36px);
    }

    .header-title,
    .header-title > .label {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    ngm-core-icon[icon='dropdown'] {
      min-width: 24px;
      max-width: 24px;
    }
  `;
}
