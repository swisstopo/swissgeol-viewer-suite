import { customElement, property } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { css, html } from 'lit';
import i18next from 'i18next';
import { applyTransition } from 'src/styles/theme';
import { BackgroundLayerVariant } from 'src/features/layer';

@customElement('ngm-background-layer-item')
export class BackgroundLayerItem extends CoreElement {
  @property()
  accessor variant!: BackgroundLayerVariant;

  @property({ type: Boolean, reflect: true, attribute: 'active' })
  accessor isActive: boolean = false;

  @property({ type: String, reflect: true })
  accessor size: Size = 'normal';

  readonly render = () => html`
    <img
      src="/thumbnails/${this.variant.id}.webp"
      alt="${i18next.t(`layers:backgrounds.${this.variant.id}`)}"
      loading="eager"
    />
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      --size: 42px;

      display: block;
      width: var(--size);
      height: var(--size);
    }
    :host([size='large']) {
      --size: 52px;
    }

    img {
      width: var(--size);
      height: var(--size);
      border-radius: 50%;
      border: 2px solid transparent;

      ${applyTransition('fade')};
      transition-property: border-color;
    }

    :host([active]) img {
      border-color: var(--color-primary--active);
    }
  `;
}

type Size = 'normal' | 'large';
