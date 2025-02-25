import { CoreElement } from 'src/features/core';
import { customElement, property } from 'lit/decorators.js';
import { css, html } from 'lit';
import { IconKey } from 'src/icons/icons';

@customElement('ngm-tool-list-item')
export class ToolListItem extends CoreElement {
  @property({ type: String })
  accessor icon: IconKey = 'config';

  readonly render = () => html`
    <ngm-core-button variant="tertiary" shape="large" justify="start">
      <ngm-core-icon icon="${this.icon}"></ngm-core-icon>
      <slot></slot>
    </ngm-core-button>
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }
  `;
}
