import { CoreElement } from 'src/features/core/core-element.element';
import { customElement, property } from 'lit/decorators.js';
import { css, html, PropertyValues } from 'lit';

@customElement('ngm-core-portal')
export class CorePortal extends CoreElement {
  @property({ type: Object })
  accessor target: HTMLElement = null as unknown as HTMLElement;

  private readonly elements: Node[] = [];

  connectedCallback() {
    super.connectedCallback();
  }

  disconnectedCallback() {
    for (const element of this.elements) {
      this.target.removeChild(element);
    }
    super.disconnectedCallback();
  }

  protected updated(_changedProperties: PropertyValues) {
    if (this.target == null) {
      return;
    }
    const slot = this.shadowRoot!.querySelector('slot')!;
    const assignedNodes = slot.assignedNodes({ flatten: true });
    assignedNodes.forEach((node) => {
      this.target.appendChild(node);
      this.elements.push(node);
    });
  }

  readonly render = () => html`
    <slot></slot>
  `;

  static readonly styles = css`
    :host {
      display: none;
    }
  `;
}
