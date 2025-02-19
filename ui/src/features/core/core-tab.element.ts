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

  @property({ type: Boolean, reflect: true, attribute: 'next' })
  accessor isPreviousSelected = false;

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute('role', 'tab');
    this.addEventListener('click', () => {
      if (this.value === null) {
        return;
      }
      this.dispatchEvent(
        new CustomEvent<TabValueChangeEventDetails<T>>('value-change', {
          bubbles: true,
          composed: true,
          detail: {
            value: this.value,
          },
        }),
      );
    });
  }

  readonly render = () => html` <slot></slot> `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      color: var(--color-primary);
      background-color: transparent;
      border: none;
      padding: 8px;
      cursor: pointer;
      border-radius: 4px;
      flex: 1;
    }

    ::slotted(*) {
      ${applyTypography('button')};
    }

    :host([aria-selected]) {
      background-color: var(--color-rest-active);
      color: var(--color-text--emphasis-medium);
    }

    :host(:not(:first-child))::before {
      content: ' ';
      position: absolute;
      left: 0;
      width: 1px;
      height: 18px;
      background-color: #e0e1e4;
    }

    :host([aria-selected])::before,
    :host([next])::before {
      display: none;
    }
  `;
}

export type TabValueChangeEvent<T> = CustomEvent<TabValueChangeEventDetails<T>>;
export interface TabValueChangeEventDetails<T> {
  value: T;
}
