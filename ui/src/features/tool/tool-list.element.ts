import { CoreElement } from 'src/features/core';
import { customElement } from 'lit/decorators.js';
import { css, html } from 'lit';
import { DrawToolVariant } from 'src/features/tool/tool.model';
import { repeat } from 'lit/directives/repeat.js';
import { identity } from 'rxjs';

@customElement('ngm-tool-list')
export class ToolList extends CoreElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'toolbar');
  }

  readonly render = () => html`
    ${repeat(
      Object.values(DrawToolVariant),
      identity,
      (variant) => html`
        <ngm-tool-list-item variant="${variant}"></ngm-tool-list-item>
      `,
    )}
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
  `;
}
