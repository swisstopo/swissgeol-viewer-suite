import { customElement } from 'lit/decorators.js';
import draggable from 'src/elements/draggable';
import { CoreElement } from 'src/features/core';
import { css, html, render } from 'lit';
import { applyEffect, applyTypography } from 'src/styles/theme';
import { Subscription } from 'rxjs';

interface CoreWindowProps {
  title: unknown | (() => unknown);
  body: unknown | (() => unknown);
  onClose?: () => void;
}

@customElement('ngm-core-window')
export class CoreWindow extends CoreElement {
  constructor() {
    super();
    this.close = this.close.bind(this);
  }

  static open(props: CoreWindowProps): CoreWindow {
    const map = document.getElementById('cesium') as HTMLElement;
    const container = document.createElement('div');
    container.classList.add('ngm-core-window-container');
    container.style.position = 'absolute';
    container.style.top = '10px';
    container.style.right = '10px';
    container.hidden = true;
    map.appendChild(container);

    const getTitle =
      typeof props.title === 'function' ? props.title : () => props.title;

    const getBody =
      typeof props.body === 'function' ? props.body : () => props.body;

    const subscription = new Subscription();

    const close = () => {
      render(null, container);
      if (container.parentElement != null) {
        map.removeChild(container);
      }
      subscription.unsubscribe();
      if (props.onClose != null) {
        props.onClose();
      }
    };

    const renderWindow = () =>
      render(
        html`
          <ngm-core-window @close="${close}" @rerender="${renderWindow}">
            <span slot="title">${getTitle()}</span>
            ${getBody()}
          </ngm-core-window>
        `,
        container,
      );

    renderWindow();

    const coreWindow = container.querySelector('ngm-core-window') as CoreWindow;
    draggable(container, {
      allowFrom: '.title',
      context: coreWindow.shadowRoot,
    });
    setTimeout(() => {
      container.hidden = false;
    });
    return coreWindow;
  }

  rerender(): void {
    this.dispatchEvent(new CustomEvent('rerender'));
  }

  close(): void {
    this.dispatchEvent(new CustomEvent('close'));
  }

  connectedCallback() {
    super.connectedCallback();
  }

  readonly render = () => html`
    <div class="title">
      <slot name="title"></slot>
      <ngm-core-button
        variant="tertiary"
        shape="icon"
        transparent
        @click="${this.close}"
      >
        <ngm-core-icon icon="close"></ngm-core-icon>
      </ngm-core-button>
    </div>
    <div class="body">
      <slot></slot>
    </div>
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      flex-direction: column;

      border-radius: 4px;
      border: 1px solid var(--sgc-color-bg--grey);
      overflow: hidden;

      ${applyEffect('overlay-shadow')}
    }

    .title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 9px 9px 9px 16px;

      background-color: var(--sgc-color-bg--grey);
      border-bottom: 1px solid var(--sgc-color-border--default);
    }

    .title,
    .title ::slotted(*) {
      ${applyTypography('body-2-bold')}
    }

    .body {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
      max-height: calc(100vh - 200px);
      overflow-x: auto;

      background-color: var(--sgc-color-bg--white);
    }
  `;
}
