import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { applyTypography } from 'src/styles/theme';

@customElement('ngm-core-info-panel')
export class CoreInfoPanel extends LitElement {
  @property()
  accessor text: string = '';

  @property()
  accessor icon: string = '';

  readonly render = () =>
    html` <div class="icon-wrapper">
        <ngm-core-icon icon=${this.icon}></ngm-core-icon>
      </div>
      <span>${this.text}</span>`;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      gap: 6px;
      border-radius: 6px;
      border: 1px solid var(--color-tertiary--hovered);
      background-color: var(--color-bg--dark);
      padding: 14px 16px 14px 14px;
    }

    .icon-wrapper {
      min-width: 28px;
      height: 28px;
      background-color: var(--color-tertiary--hovered);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    ngm-core-icon {
      height: 16px;
      width: 16px;
    }

    input {
      border-radius: 3px;
      border: 1px solid #596978;
      height: 44px;
    }

    span {
      ${applyTypography('body-2-bold')};
      padding-left: 11px;
    }
  `;
}

export type InputChangeEvent = CustomEvent<InputChangeEventDetail>;

export interface InputChangeEventDetail {
  value: string;
}
