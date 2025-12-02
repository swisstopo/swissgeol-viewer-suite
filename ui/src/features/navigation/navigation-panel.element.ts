import { LitElementI18n } from 'src/i18n';
import { css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ngm-navigation-panel')
export class NavigationPanel extends LitElementI18n {
  @property({ type: String, reflect: true })
  accessor size: 'normal' | 'large' = 'normal';

  readonly render = () => html`<slot></slot>`;

  static readonly styles = css`
    :host {
      --panel-height: calc(100vh - var(--ngm-header-height));
      --panel-header-height: 64px;

      box-sizing: border-box;
      position: absolute;
      width: 440px;
      max-width: 100vw;
      height: var(--panel-height);
      max-height: var(--panel-height);
      padding: 0;

      display: flex;
      flex-direction: column;
      align-content: flex-start;
      overflow-y: hidden;
      box-shadow: 4px 0 4px #00000029;
      z-index: 5;

      background-color: var(--color-bg--dark);
    }

    :host([size='large']) {
      width: 860px;
    }
  `;
}
