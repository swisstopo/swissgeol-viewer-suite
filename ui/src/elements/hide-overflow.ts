import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('hide-overflow')
export class HideOverflow extends LitElement {
  declare private readonly observer: IntersectionObserver;

  constructor() {
    super();
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          (entry.target as HTMLElement).style.visibility =
            entry.intersectionRatio < 1 ? 'hidden' : 'visible';
        });
      },
      {
        root: this,
        threshold: [0.0, 1.0],
      },
    );
  }

  slotReady(event: Event) {
    const items = (event.target as HTMLSlotElement).assignedElements();
    items.forEach((item) => this.observer.observe(item));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.observer.disconnect();
  }

  override render() {
    return html` <slot @slotchange="${this.slotReady}"></slot> `;
  }
}
