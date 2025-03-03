import { CoreElement } from 'src/features/core/core-element.element';
import { css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { applyTypography } from 'src/styles/theme';

@customElement('ngm-core-tab')
export class CoreTab<T> extends CoreElement {
  @property()
  accessor value: T | null = null;

  @property({ type: Boolean, reflect: true, attribute: 'aria-selected' })
  accessor isSelected = false;

  @property({ type: Boolean, reflect: true, attribute: 'standalone' })
  accessor isStandalone = false;

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute('role', 'tab');
    this.addEventListener('click', () => {
      if (this.isStandalone) {
        return;
      }
      this.dispatchEvent(
        new CustomEvent<TabValueChangeEventDetails<T>>('value-change', {
          bubbles: true,
          composed: true,
          detail: {
            value: this.value as T,
          },
        }),
      );
    });
  }

  readonly render = () => html`
    <div class="container">
      <slot></slot>
    </div>
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      position: relative;
      display: flex;
      justify-content: stretch;
      align-items: stretch;
      flex: 1;

      margin-left: calc(-1px);
    }

    :host([aria-selected]) {
      z-index: 3;
    }

    /* container */
    .container {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      color: var(--color-primary);
      background-color: transparent;
      border: none;
      padding: 8px;
      border-radius: 4px;
      cursor: pointer;
      z-index: 2;
    }

    :host([aria-selected]) .container {
      color: var(--color-text--emphasis-medium);
      background-color: var(--color-rest-active);
    }

    :host(:not([aria-selected]):hover) .container {
      color: var(--color-text--emphasis-medium);
      background-color: var(--color-secondary--hovered);
    }

    /* slot */
    ::slotted(*) {
      ${applyTypography('button')};
    }

    /* separator */
    :host(:not(:first-of-type))::before {
      content: ' ';
      position: absolute;
      margin-block: auto;
      left: 0;
      top: 0;
      bottom: 0;
      width: 1px;
      height: 18px;
      background-color: #e0e1e4;
      z-index: 1;
    }
  `;
}

export type TabValueChangeEvent<T> = CustomEvent<TabValueChangeEventDetails<T>>;
export interface TabValueChangeEventDetails<T> {
  value: T;
}
