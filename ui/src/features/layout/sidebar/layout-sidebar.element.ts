import i18next from 'i18next';
import { css, html, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { SidebarPanel } from 'src/features/layout/layout.model';
import 'src/ngm-app-settings';
import { LayerService } from 'src/features/layer/new/layer.service';
import { consume } from '@lit/context';
import { until } from 'lit/directives/until.js';

@customElement('ngm-layout-sidebar')
export class LayoutSidebar extends CoreElement {
  @state()
  accessor activePanel: SidebarPanel | null = null;

  @state()
  accessor countOfLayers = 0;

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  private promise: Promise<unknown> | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.role = 'navigation';

    this.register(
      this.layerService.activeLayerIds$.subscribe((ids) => {
        this.countOfLayers = ids.length;
      }),
    );
  }

  private readonly handlePanelActivation = (
    event: CustomEvent<{ panel: SidebarPanel }>,
  ) => {
    this.activePanel = event.detail.panel;
    if (this.activePanel === SidebarPanel.Layers) {
      this.promise =
        customElements.get('ngm-catalog') === undefined
          ? import('src/features/catalog/catalog.module')
          : null;
    } else {
      this.promise = null;
    }
  };

  private readonly handlePanelDeactivation = (
    event: CustomEvent<{ panel: SidebarPanel }>,
  ) => {
    if (this.activePanel === event.detail.panel) {
      this.closePanel();
    }
  };

  private readonly closePanel = () => {
    this.activePanel = null;
  };

  // We currently do not get around to keeping this component open,
  // as it holds multiple open components that heavily rely on global css and js behavior.
  // If we ever get to refactor these nested components (first and foremost, the toolbox), we can remove this,
  // alongside the awkward css handling we are doing in here.
  createRenderRoot() {
    return this;
  }

  readonly render = () => html`
    <!-- Inject the "local" styles as global, as we currently disable the shadow dom on this component. -->
    <style>
      ${LayoutSidebar.stylesAsGlobal.cssText}
    </style>

    ${this.renderItems()}
    <ngm-navigation-panel
      ?open="${this.activePanel !== null}"
      .size="${this.activePanel === SidebarPanel.Projects ? 'large' : 'normal'}"
    >
      <ngm-navigation-panel-header closeable @close="${this.closePanel}">
        ${i18next.t(`layout:items.${this.activePanel}`)}
      </ngm-navigation-panel-header>
      ${this.renderPanel()}
    </ngm-navigation-panel>
  `;

  private readonly renderItems = () => html`
    <ul>
      <li>
        ${this.renderItem({
          panel: SidebarPanel.Layers,
          icon: 'layer',
          counter: this.countOfLayers,
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

  private readonly renderPanel = () => {
    // These are panels that need to stay rendered even if they are not displayed.
    // This is due to two reasons:
    //
    //   1. They create global objects and/or subscriptions that are not cleaned up when the panel itself is removed,
    //      meaning that removing and re-adding the panels will cause state duplications.
    //   2. They create and manage global state (such as viewer data sources) that is in use by other parts of the application.
    //
    // Ideally, we will get to refactor these at some point, so we do not need to render more than necessary.
    // Additionally, tying global state to semi-permanent ui is kind of bad for readability,
    // separation of concerns and other stuff, so getting rid of these panels will help the rest of the application too.
    const staticPanels = html`
      <ngm-tools
        .toolsHidden=${this.activePanel !== SidebarPanel.Tools}
      ></ngm-tools>
      <ngm-dashboard
        ?hidden=${this.activePanel !== SidebarPanel.Projects}
      ></ngm-dashboard>
    `;

    const render = () => {
      this.promise = null;
      switch (this.activePanel) {
        case SidebarPanel.Layers:
          return html`
            <div class="content">
              <ngm-catalog></ngm-catalog>
            </div>
            ${staticPanels}
          `;
        case SidebarPanel.Share:
          return html`
            <div class="content">
              <ngm-share-link></ngm-share-link>
            </div>
            ${staticPanels}
          `;
        case SidebarPanel.Settings:
          return html`
            <div class="content">
              <ngm-app-settings></ngm-app-settings>
            </div>
            ${staticPanels}
          `;
        case SidebarPanel.Projects:
        case SidebarPanel.Tools:
        case null:
          return staticPanels;
      }
    };

    return this.promise == null
      ? render()
      : until(
          this.promise.then(render),
          html`<div class="content">
              <ngm-core-loader></ngm-core-loader>
            </div>
            ${staticPanels}`,
        );
  };

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

    ngm-navigation-panel > .content {
      padding: 16px;

      height: calc(var(--panel-height) - var(--panel-header-height));
    }
  `;

  // This transforms the `styles` value into a globally usable css.
  // This should be safe, with the caveat that nested, non-shadow-dom components may be affected by the styles.
  private static readonly stylesAsGlobal = css`
    ngm-layout-sidebar {
      ${unsafeCSS(LayoutSidebar.styles.cssText.replaceAll(':host', '&'))}
    }
  `;
}
