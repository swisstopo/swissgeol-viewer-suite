import { customElement, property, query, state } from 'lit/decorators.js';
import { css, html } from 'lit';
import { LitElementI18n } from 'src/i18n';
import { LayerConfig } from 'src/layertree';
import i18next from 'i18next';
import { renderTabs, TabValueChangeEvent } from 'src/features/core';

@customElement('ngm-layer-tabs')
export class LayerTabs extends LitElementI18n {
  @property()
  public accessor layers: LayerConfig[] | null = null;

  @property({ type: Function })
  accessor onKmlUpload!: (file: File, clampToGround: boolean) => Promise<void> | void;

  @state()
  private accessor activeTab: Tab = Tab.Catalog;

  //TODO: where is this from exactly?
  @query('.ngm-toast-placeholder')
  accessor toastPlaceholder!: HTMLElement;

  private handleTabChange(event: TabValueChangeEvent<Tab>): void {
    this.activeTab = event.detail.value;
  }

  private readonly translateTabName = (tab: Tab) => i18next.t(`dtd_tab_labels.${tab}`);

  readonly render = () => html`
    ${renderTabs(Tab, {
      value: this.activeTab,
      onValueChange: this.handleTabChange,
      tab: this.translateTabName,
      panels: {
        [Tab.Catalog]: html`
          <ngm-layer-catalog .layers=${this.layers}></ngm-layer-catalog>
        `,
        [Tab.Upload]: html`
          <ngm-layer-upload .toastPlaceholder=${this.toastPlaceholder}></ngm-layer-upload>
        `,
        [Tab.Options]: html`
          <ngm-layer-options></ngm-layer-options>
        `,
      },
    })}
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }
  `;
}

enum Tab {
  Catalog = 'catalog',
  Upload = 'upload',
  Options = 'options',
}
