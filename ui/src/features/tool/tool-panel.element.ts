import { customElement, state } from 'lit/decorators.js';
import { CoreElement, renderTabs, TabValueChangeEvent } from 'src/features/core';
import { css, html } from 'lit';
import i18next from 'i18next';

@customElement('ngm-tool-panel')
export class ToolPanel extends CoreElement {
  @state()
  private accessor activeTab = Tab.Draw;

  private close(): void {
    this.dispatchEvent(new CustomEvent('close'));
  }

  private handleTabChange(event: TabValueChangeEvent<Tab>): void {
    this.activeTab = event.detail.value;
  }

  private readonly translateTabName = (tab: Tab) => i18next.t(`tool.tabs.${tab}`, { ns: 'features' });

  readonly render = () => html`
    <ngm-navigation-panel>
      <ngm-navigation-panel-header slot="heading" closeable @close="${this.close}">
        ${i18next.t('tool.heading', { ns: 'features' })}
      </ngm-navigation-panel-header>
      ${renderTabs(Tab, {
        value: this.activeTab,
        onValueChange: this.handleTabChange,
        tab: this.translateTabName,
        panels: {
          [Tab.Draw]: html`
            <ngm-tool-list></ngm-tool-list>
          `,
          [Tab.Measure]: html``,
          [Tab.Upload]: html``,
        },
      })}
    </ngm-navigation-panel>
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }
  `;
}

enum Tab {
  Draw = 'draw',
  Measure = 'measure',
  Upload = 'upload',
}
