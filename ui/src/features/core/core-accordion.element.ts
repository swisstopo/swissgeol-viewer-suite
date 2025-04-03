// my-accordion.ts
import { css, html, LitElement } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';

@customElement('ngm-core-accordion')
export class CoreAccordion extends LitElement {
  @state() private accessor isOpen = false;
  @query('slot[name="header"]') private accessor headerSlot!: HTMLSlotElement;

  private toggle() {
    this.isOpen = !this.isOpen;
    this.updateHeaderClass();
  }

  private updateHeaderClass() {
    const headerNodes =
      this.headerSlot?.assignedElements({ flatten: true }) ?? [];
    headerNodes.forEach((node) => {
      if (node instanceof HTMLElement) {
        node.classList.toggle('active', this.isOpen);
      }
    });
  }

  render() {
    return html`
      <div class="header" @click=${this.toggle}>
        <slot name="header"></slot>
      </div>
      <div class="content" ?open=${this.isOpen}>
        <slot></slot>
      </div>
    `;
  }

  static readonly styles = css`
    .header {
      cursor: pointer;
    }

    .content {
      display: none;
    }

    .content[open] {
      display: block;
    }
  `;
}
