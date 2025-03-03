import { CoreElement } from 'src/features/core/core-element.element';
import { customElement, property, query } from 'lit/decorators.js';
import { css, html, PropertyValues, TemplateResult } from 'lit';
import { CoreTab, TabValueChangeEvent } from 'src/features/core/core-tab.element';
import { CoreTabPanel } from 'src/features/core/core-tab-panel.element';
import { repeat } from 'lit/directives/repeat.js';
import { identity } from 'rxjs';

@customElement('ngm-core-tab-list')
export class CoreTabList<T> extends CoreElement {
  @property()
  accessor value: T | null = null;

  @query('slot')
  accessor slotElement: HTMLSlotElement | null = null;

  @query('.panels')
  accessor panelsElement: HTMLElement | null = null;

  private readonly panels: CoreTabPanel<T>[] = [];

  update(changedProperties: PropertyValues<this>): void {
    super.update(changedProperties);
    if (changedProperties.has('value')) {
      this.syncActiveValue();
    }
  }

  firstUpdated(): void {
    this.syncActiveValue();
  }

  private syncActiveValue(): void {
    const content = this.slotElement?.assignedElements();
    if (content == null || this.panelsElement == null) {
      return;
    }
    let i = 0;
    for (const node of content) {
      if (node instanceof CoreTab) {
        if (!node.isStandalone) {
          node.isSelected = node.value === this.value;
        }
        node.style.setProperty('--tab-index', `${i}`);
        i += 1;
        continue;
      }
      if (node instanceof CoreTabPanel) {
        this.panels.push(node);
        this.panelsElement.appendChild(node);
      }
    }
    for (const panel of this.panels) {
      panel.isHidden = panel.value !== this.value;
    }
  }

  readonly render = () => html`
    <div role="tablist">
      <slot></slot>
    </div>
    <div class="panels"></div>
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

    [role='tablist'] {
      display: flex;
      justify-content: space-evenly;
      align-items: center;
      background-color: white;
      min-height: 52px;
      border-radius: 4px;
      padding: 6px;
    }
  `;
}

export const renderTabs = <T extends Record<never, V>, V extends string>(
  tabs: T,
  config: {
    value: V;
    onValueChange: (event: TabValueChangeEvent<V>) => void;
    tab: (value: V) => unknown;
    panels: { [P in V]: unknown };
  },
): TemplateResult => html`
  <ngm-core-tab-list .value="${config.value}" @value-change="${config.onValueChange}">
    ${repeat(
      Object.values(tabs) as V[],
      identity,
      (value) => html`
        <ngm-core-tab .value="${value}">${config.tab(value)}</ngm-core-tab>
      `,
    )}
    ${repeat(
      Object.entries(config.panels),
      ([value]) => value,
      ([value, template]) => html`
        <ngm-core-tab-panel .value="${value}">${template}</ngm-core-tab-panel>
      `,
    )}
  </ngm-core-tab-list>
`;
