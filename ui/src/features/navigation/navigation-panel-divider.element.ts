import { LitElementI18n } from 'src/i18n';
import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('ngm-navigation-panel-divider')
export class NavigationPanel extends LitElementI18n {
  connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'separator');
  }

  readonly render = () => html``;

  static readonly styles = css`
    :host {
      box-sizing: border-box;
      display: block;
      height: 1px;
      margin: 0 12px;
      border: 0;
      background-color: var(--color-border--emphasis-high);
    }
  `;
}
