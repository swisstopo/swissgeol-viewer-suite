import { CoreElement } from 'src/features/core/core-element.element';
import { css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ngm-core-tab-panel')
export class CoreTabPanel<T> extends CoreElement {
  @property()
  accessor value: T | null = null;

  @property({ type: Boolean, reflect: true, attribute: 'hidden' })
  accessor isHidden = false;

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute('role', 'tabpanel');
  }

  readonly render = () => html`
    <slot></slot>
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host([hidden]) {
      display: none;
    }
  `;
}
