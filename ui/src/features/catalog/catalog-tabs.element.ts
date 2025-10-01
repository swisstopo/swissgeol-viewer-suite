import { customElement, state } from 'lit/decorators.js';
import { css, html } from 'lit';
import { Viewer } from 'cesium';
import { classMap } from 'lit/directives/class-map.js';
import i18next from 'i18next';
import { applyTypography, hostStyles } from 'src/styles/theme';
import { CoreElement } from 'src/features/core';
import { viewerContext } from 'src/context';
import { consume } from '@lit/context';

@customElement('ngm-catalog-tabs')
export class CatalogTabs extends CoreElement {
  @state()
  private accessor activeTab: Tab = Tab.Catalog;

  @consume({ context: viewerContext })
  accessor viewer!: Viewer;

  readonly render = () => html`
    <div class="tabs">
      ${this.renderTabButton(Tab.Catalog)}
      ${this.renderTabSeparator(Tab.Catalog, Tab.Upload)}
      ${this.renderTabButton(Tab.Upload)}
      ${this.renderTabSeparator(Tab.Upload, Tab.Options)}
      ${this.renderTabButton(Tab.Options)}
    </div>
    <div ?hidden="${this.activeTab !== Tab.Catalog}" data-cy="${Tab.Catalog}">
      ${this.renderCatalog()}
    </div>
    <div ?hidden="${this.activeTab !== Tab.Upload}" data-cy="${Tab.Upload}">
      <ngm-catalog-upload></ngm-catalog-upload>
    </div>
    <div ?hidden="${this.activeTab !== Tab.Options}" data-cy="${Tab.Options}">
      <ngm-catalog-settings></ngm-catalog-settings>
    </div>
  `;

  readonly renderTabButton = (tab: Tab) => html`
    <button
      @click="${() => (this.activeTab = tab)}"
      class="${classMap({ 'is-active': this.activeTab === tab })}"
      data-cy="${tab}"
    >
      ${i18next.t(`catalog:tabs.${tab}`)}
    </button>
  `;

  readonly renderTabSeparator = (a: Tab, b: Tab) => html`
    <div
      class="separator ${classMap({
        'is-active': this.activeTab !== a && this.activeTab !== b,
      })}"
    ></div>
  `;

  private readonly renderCatalog = () => html``;

  static readonly styles = css`
    ${hostStyles}

    :host {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .tabs {
      display: flex;
      justify-content: space-evenly;
      align-items: center;
      background-color: white;
      min-height: 52px;
      border-radius: 4px;
      padding: 6px;
    }

    .tabs > button {
      ${applyTypography('button')};

      color: var(--color-primary);
      background-color: transparent;
      border: none;
      padding: 8px;
      cursor: pointer;
      border-radius: 4px;
      flex: 1;
    }

    .tabs > button.is-active {
      background-color: var(--color-rest-active);
      color: var(--color-text--emphasis-medium);
    }

    .tabs > .separator {
      border: 1px solid #e0e1e4;
      height: 18px;
    }

    .tabs > .separator:not(.is-active) {
      display: none;
    }
  `;
}

enum Tab {
  Catalog = 'Catalog',
  Upload = 'Upload',
  Options = 'Options',
}
