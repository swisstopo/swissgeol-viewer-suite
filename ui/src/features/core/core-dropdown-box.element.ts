import { css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CoreBasePopupBox } from 'src/features/core/base/core-base-popup-box.element';
import { applyEffect, applyTypography } from 'src/styles/theme';

@customElement('ngm-core-dropdown-box')
export class CoreDropdownBox extends CoreBasePopupBox {
  static readonly styles = css`
    ${CoreBasePopupBox.styles}

    :host {
      ${applyTypography('body-2')};

      display: flex;
      flex-direction: column;
      align-items: stretch;
      width: 205px;
      border-radius: 4px;
      border: 1px solid var(--color-border--default);
      height: calc(48px * var(--count) + 2px);

      background-color: var(--color-bg--white);
      color: var(--color-text--emphasis-high);
      overflow: hidden;

      transition-property: opacity, height;

      ${applyEffect('bottom-shadow')};
    }

    :host(:not(.is-visible)) {
      height: 0;
    }
  `;
}
