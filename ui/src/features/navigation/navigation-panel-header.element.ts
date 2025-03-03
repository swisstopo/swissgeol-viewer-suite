import { LitElementI18n } from 'src/i18n';
import { css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../core';
import { applyTypography } from 'src/styles/theme';

@customElement('ngm-navigation-panel-header')
export class NavigationPanelHeader extends LitElementI18n {
  @property({ type: Boolean, attribute: 'closeable' })
  accessor isCloseable: boolean = false;

  constructor() {
    super();

    this.close = this.close.bind(this);
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent('close'));
  }

  readonly render = () => html`
    <h2>
      <slot></slot>
    </h2>
    ${this.isCloseable
      ? html`
          <ngm-core-icon icon="close" interactive @click=${this.close}></ngm-core-icon>
        `
      : nothing}
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 12px 14px 16px;
      height: 64px;
      border-bottom: 1px solid #e0e2e6;
    }

    h2 {
      ${applyTypography('modal-title-1')};
      margin: 0;
    }
  `;
}
