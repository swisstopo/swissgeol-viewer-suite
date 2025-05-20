import { css, html, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { LayerConfig, LayerTreeNode } from 'src/layertree';
import '../core';
import { CoreElement } from 'src/features/core';
import { repeat } from 'lit/directives/repeat.js';

@customElement('ngm-layer-catalog')
export class LayerCatalog extends CoreElement {
  @property()
  accessor layers!: LayerConfig[];

  readonly render = () =>
    html`${repeat(
      this.layers,
      (node) => node.layer ?? node.label ?? node,
      (node) => getCategoryOrLayerTemplate(node, true),
    )}`;

  static readonly styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    :host,
    :host * {
      box-sizing: border-box;
    }
  `;
}

export const getCategoryOrLayerTemplate = (
  node: LayerTreeNode,
  isTopLevel: boolean,
): TemplateResult => {
  if (node.children) {
    return html`<ngm-layer-catalog-category
      .node="${node}"
      .isTopLevel="${isTopLevel}"
    ></ngm-layer-catalog-category>`;
  }
  return html`<ngm-layer-catalog-item
    .layer="${node}"
  ></ngm-layer-catalog-item>`;
};
