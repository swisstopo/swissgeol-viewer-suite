import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';

@customElement('ngm-lexic')
export class Lexic extends CoreElement {
  readonly render = () => html`
    <section>
      <h2>Lexic</h2>
      <p>Lexic panel</p>
    </section>
  `;

  static readonly styles = css`
    :host {
      display: block;
      min-height: 100%;
      color: var(--color-main);
    }

    section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    h2,
    p {
      margin: 0;
    }
  `;
}
