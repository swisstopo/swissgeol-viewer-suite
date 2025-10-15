import { css, html } from 'lit';
import { customElement, query } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';

@customElement('ngm-catalog')
export class Catalog extends CoreElement {
  @query('section.layers')
  private accessor layersElement!: HTMLDivElement;

  @query('section.tabs')
  private accessor tabsElement!: HTMLDivElement;

  firstUpdated() {
    this.initializeHeightSync();
  }

  private initializeHeightSync(): void {
    const observer = new ResizeObserver(() => {
      const rect = this.layersElement.getBoundingClientRect();
      this.tabsElement.style.setProperty('--layers-height', `${rect.height}px`);
    });
    observer.observe(this.layersElement);
    this.register(() => observer.disconnect());
  }

  readonly render = () => html`
    <section class="layers"></section>
    <section class="tabs">
      <ngm-catalog-tabs></ngm-catalog-tabs>
    </section>
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    /* sections */
    .content > section {
      position: relative;
      overflow-y: auto;
    }

    .content > section.layers {
      /*
       * Layers can take up half of the available space,
       * minus half the space reserved by the header and padding/gap.
       */
      max-height: calc(50% - var(--header-height) / 2 - 16px);
    }

    .content > section.tabs {
      max-height: calc(100% - var(--header-height) - var(--layers-height, 0));
    }
  `;
}
