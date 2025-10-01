import i18next from 'i18next';
import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { SidebarPanel } from 'src/features/layout/layout.model';

@customElement('ngm-layout-sidebar')
export class LayoutSidebar extends CoreElement {
  @state()
  accessor activePanel: SidebarPanel | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.role = 'navigation';
  }

  private readonly handlePanelActivation = (
    event: CustomEvent<{ panel: SidebarPanel }>,
  ) => {
    this.activePanel = event.detail.panel;
  };

  private readonly handlePanelDeactivation = (
    event: CustomEvent<{ panel: SidebarPanel }>,
  ) => {
    if (this.activePanel === event.detail.panel) {
      this.activePanel = null;
    }
  };

  readonly render = () => html`
    <ul>
      <li>
        ${this.renderItem({
          panel: SidebarPanel.Layers,
          icon: 'layer',
          counter: 0, // TODO
        })}
        ${this.renderItem({
          panel: SidebarPanel.Tools,
          icon: 'tools',
          counter: 0, // TODO
        })}
        ${this.renderItem({
          panel: SidebarPanel.Projects,
          icon: 'projects',
        })}
        ${this.renderItem({
          panel: SidebarPanel.Share,
          icon: 'share',
        })}
      </li>
    </ul>
    <ul>
      ${this.renderItem({
        panel: SidebarPanel.Settings,
        icon: 'config',
      })}
    </ul>
    <ngm-navigation-panel ?open="${this.activePanel !== null}">
      <ngm-navigation-panel-header>
        ${i18next.t(`layout:items.${this.activePanel}`)}
      </ngm-navigation-panel-header>
    </ngm-navigation-panel>
  `;

  private readonly renderItem = (options: {
    panel: SidebarPanel;
    icon: string;
    counter?: number;
  }) => html`
    <li>
      <ngm-layout-sidebar-item
        .panel="${options.panel}"
        icon="${options.icon}"
        .counter="${options.counter ?? 0}"
        ?active="${options.panel === this.activePanel}"
        @activate="${this.handlePanelActivation}"
        @deactivate="${this.handlePanelDeactivation}"
      ></ngm-layout-sidebar-item>
    </li>
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      padding: 12px 6px 2px 6px;

      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
    }

    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    ngm-navigation-panel {
      position: absolute;
      top: 0;
      left: 80px;
    }

    ngm-navigation-panel:not([open]) {
      display: none;
    }
  `;
}
