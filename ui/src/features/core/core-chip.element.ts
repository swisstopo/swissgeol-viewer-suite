import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { applyTypography } from 'src/styles/theme';

@customElement('ngm-core-chip')
export class CoreChip extends LitElement {
  @property({ reflect: true })
  accessor variant: ChipVariant = 'default';

  readonly render = () => html` <slot></slot> `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      border-radius: 22px;
      min-width: 22px;
      height: 22px;
      padding: 0 4px;

      justify-content: center;
      align-items: center;

      ${applyTypography('overline')}
      font-weight: 700;
    }

    :host([variant='default']) {
      background-color: var(--color-border--default);
      color: var(--color-text--emphasis-high);
    }

    :host([variant='primary']) {
      background-color: var(--color-bg--white);
      color: var(--color-primary);
    }

    :host([variant='highlight']) {
      background-color: var(--color-active--highlight);
      color: var(--color-bg--white);
    }
  `;
}

export type ChipVariant = 'default' | 'primary' | 'highlight';
