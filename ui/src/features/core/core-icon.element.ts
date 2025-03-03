import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { IconKey, icons } from 'src/icons/icons';

@customElement('ngm-core-icon')
export class CoreIcon extends LitElement {
  @property()
  accessor icon: IconKey = 'config';

  @property({ type: Boolean, reflect: true, attribute: 'interactive' })
  accessor isInteractive: boolean = false;

  @property({ type: String, reflect: true, attribute: 'size' })
  accessor size: Size = 'normal';

  readonly render = () => {
    return html`
      ${icons[this.icon]}
    `;
  };

  static readonly styles = css`
    :host {
      display: inline-flex;
      color: currentColor;
      width: 24px;
      height: 24px;
    }

    :host([size='small']) {
      width: 20px;
      height: 20px;
    }

    :host([interactive]:hover) {
      cursor: pointer;
      color: var(--color-action);
    }

    svg {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  `;
}

type Size = 'small' | 'normal';
