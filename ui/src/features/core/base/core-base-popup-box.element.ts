import { css, html, LitElement } from 'lit';
import { applyTransition } from 'src/styles/theme';

export abstract class CoreBasePopupBox extends LitElement {
  private timeoutForToggle: unknown = null;

  protected constructor() {
    super();
    this.show = this.show.bind(this);
    this.hide = this.hide.bind(this);
  }

  show(): void {
    this.clearToggle();
    this.classList.remove('is-hidden');
    this.timeoutForToggle = setTimeout(() => {
      this.classList.add('is-visible');
    });
  }

  hide(): void {
    this.clearToggle();
    this.classList.remove('is-visible');
    this.timeoutForToggle = setTimeout(() => {
      this.classList.add('is-hidden');
    }, 250);
  }

  private clearToggle(): void {
    if (this.timeoutForToggle !== null) {
      clearTimeout(this.timeoutForToggle as number);
    }
  }

  readonly render = () => html`<slot></slot>`;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      position: fixed;
      z-index: 10;

      ${applyTransition('fade')};
      transition-property: opacity;
    }

    :host(.is-hidden) {
      display: none;
    }

    :host(:not(.is-visible)) {
      opacity: 0;
    }
  `;
}
