import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ngm-core-loader')
export class CoreLoader extends LitElement {
  @property({ reflect: true })
  accessor color: CoreLoaderColor = 'brand';

  readonly render = () => html`<span class="loader"></span>`;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      display: inline-flex;
      width: 100%;
      justify-content: center;
      padding: 8px;
    }

    .loader {
      display: block;

      width: 48px;
      height: 48px;
      background: var(--color);
      border-radius: 50%;
      box-sizing: border-box;
      animation: loader 1s ease-in infinite;
    }

    :host([color='brand']) {
      --color: var(--sgc-color-brand);
    }

    :host([color='primary']) {
      --color: var(--sgc-color-primary);
    }

    :host([color='secondary']) {
      --color: var(--sgc-color-secondary);
    }

    @keyframes loader {
      0% {
        transform: scale(0);
        opacity: 1;
      }
      100% {
        transform: scale(1);
        opacity: 0;
      }
    }
  `;
}

export type CoreLoaderColor = 'brand' | 'primary' | 'secondary';
