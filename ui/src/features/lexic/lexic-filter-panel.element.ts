import { consume } from '@lit/context';
import i18next from 'i18next';
import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { applyTypography } from 'src/styles/theme';
import {
  getLayerLabel,
  LayerService,
  LayerType,
  WmtsLayer,
} from 'src/features/layer';
import { LexicApiService } from './lexic-api.service';
import { LexicFilterService } from './lexic-filter.service';
import { LexicLanguage, LexicLayerFiltersResponse } from './lexic-api.model';

type LexicLayerOption = {
  id: string;
  name: string;
};

@customElement('ngm-lexic-filter-panel')
export class LexicFilterPanel extends CoreElement {
  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  @consume({ context: LexicApiService.context() })
  accessor lexicApiService!: LexicApiService;

  @consume({ context: LexicFilterService.context() })
  accessor filterService!: LexicFilterService;

  @state()
  accessor isOpen = false;

  @state()
  accessor layerOptions: LexicLayerOption[] = [];

  @state()
  accessor selectedLayerId = '';

  @state()
  accessor isLoadingLayers = false;

  @state()
  accessor isLoadingFilters = false;

  @state()
  accessor selectedLayerFilters: LexicLayerFiltersResponse | null = null;

  private filtersRequestVersion = 0;

  connectedCallback(): void {
    super.connectedCallback();

    this.register(
      this.filterService.isOpen$.subscribe((isOpen) => {
        this.isOpen = isOpen;
      }),
    );

    void this.loadLayerOptions();
  }

  willChangeLanguage(_language: void): void {
    void this.loadLayerOptions();
    void this.loadSupportedFiltersForSelectedLayer();
  }

  private readonly handleClose = () => {
    this.filterService.close();
  };

  private readonly handleLayerSelection = (event: Event) => {
    const selectElement = event.target as HTMLSelectElement;
    this.selectedLayerId = selectElement.value;
    void this.loadSupportedFiltersForSelectedLayer();
  };

  private getLexicLanguage(): LexicLanguage {
    const language = i18next.resolvedLanguage ?? i18next.language;

    if (language.startsWith('de')) {
      return 'de';
    }

    if (language.startsWith('fr')) {
      return 'fr';
    }

    if (language.startsWith('it')) {
      return 'it';
    }

    return 'en';
  }

  /** Strips the namespace prefix (e.g. "swisstopo:") from the layer config ID. */
  private toLexicLayerId(configLayerId: string): string {
    const colonIndex = configLayerId.indexOf(':');
    return colonIndex >= 0
      ? configLayerId.substring(colonIndex + 1)
      : configLayerId;
  }

  private async loadSupportedFiltersForSelectedLayer(): Promise<void> {
    const layerId = this.selectedLayerId;
    const requestVersion = ++this.filtersRequestVersion;

    if (layerId === '') {
      this.selectedLayerFilters = null;
      this.isLoadingFilters = false;
      return;
    }

    this.isLoadingFilters = true;
    try {
      const filters = await this.lexicApiService.getLayerFilters(
        this.toLexicLayerId(layerId),
        this.getLexicLanguage(),
      );

      if (
        this.filtersRequestVersion === requestVersion &&
        this.selectedLayerId === layerId
      ) {
        this.selectedLayerFilters = filters;
      }
    } catch (error) {
      console.error(
        `[Lexic] Failed to load filters for layer "${layerId}":`,
        error,
      );
      if (
        this.filtersRequestVersion === requestVersion &&
        this.selectedLayerId === layerId
      ) {
        this.selectedLayerFilters = null;
      }
    } finally {
      if (this.filtersRequestVersion === requestVersion) {
        this.isLoadingFilters = false;
      }
    }
  }

  private async loadLayerOptions(): Promise<void> {
    this.isLoadingLayers = true;

    try {
      await this.layerService.ready;

      this.layerOptions = this.layerService.layerIds
        .map((id) => this.layerService.layerOrNull(id))
        .filter((layer): layer is WmtsLayer => {
          return layer?.type === LayerType.Wmts && layer.service === 'lexic';
        })
        .map((layer) => ({ id: String(layer.id), name: getLayerLabel(layer) }));

      const requestedId = this.filterService.consumeRequestedDatasetId();
      const firstId = this.layerOptions[0]?.id ?? '';
      const preferredId =
        requestedId != null &&
        this.layerOptions.some((l) => l.id === requestedId)
          ? requestedId
          : firstId;
      if (
        this.selectedLayerId === '' ||
        !this.layerOptions.some((l) => l.id === this.selectedLayerId)
      ) {
        this.selectedLayerId = preferredId;
      }
      void this.loadSupportedFiltersForSelectedLayer();
    } catch {
      this.layerOptions = [];
      this.selectedLayerId = '';
    } finally {
      this.isLoadingLayers = false;
    }
  }

  readonly render = () => {
    if (!this.isOpen) {
      return nothing;
    }

    return html`
      <div class="floating-panel">
        <header class="panel-header">
          <span class="panel-title"
            >${i18next.t('layout:items.Lexic')} Filter</span
          >
          <ngm-core-icon
            icon="close"
            interactive
            @click=${this.handleClose}
          ></ngm-core-icon>
        </header>

        <div class="panel-body">
          <section class="dataset-section">
            <span class="section-header-label"
              >${i18next.t('layout:lexic.datasetLabel')}</span
            >
            ${this.isLoadingLayers
              ? html`<ngm-core-loader></ngm-core-loader>`
              : html`
                  <div class="select-wrapper">
                    <select
                      .value=${this.selectedLayerId}
                      @change=${this.handleLayerSelection}
                    >
                      ${this.layerOptions.map(
                        (layer) =>
                          html`<option value="${layer.id}">
                            ${layer.name}
                          </option>`,
                      )}
                    </select>
                    <ngm-core-icon icon="dropdown"></ngm-core-icon>
                  </div>
                `}
          </section>

          <div class="horizontal-divider"></div>

          ${this.isLoadingFilters
            ? html`<ngm-core-loader></ngm-core-loader>`
            : html`<ngm-lexic-filter-container
                .layerFilters=${this.selectedLayerFilters}
              ></ngm-lexic-filter-container>`}
        </div>
      </div>
    `;
  };

  static readonly styles = css`
    :host {
      position: fixed;
      top: var(--ngm-header-height, 88px);
      right: 72px;
      z-index: 4;
      pointer-events: none;
    }

    .floating-panel {
      pointer-events: auto;
      display: flex;
      flex-direction: column;
      width: 320px;
      max-height: calc(100vh - var(--ngm-header-height, 88px) - 20px);
      margin-top: 10px;
      background-color: var(--color-bg--white, #fff);
      box-shadow: 4px 4px 2px #00000029;
      border-radius: 8px;
      overflow: hidden;
      color: var(--color-text--emphasis-high);
    }

    .panel-header {
      ${applyTypography('subtitle-1')};
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      background-color: var(--color-bg--dark);
      border-bottom: 1px solid #e0e2e6;
      flex-shrink: 0;
    }

    .panel-title {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: bold;
    }

    .panel-body {
      padding: 16px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .dataset-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }

    .section-header {
      ${applyTypography('body-2')};
      display: flex;
      align-items: center;
      color: var(--color-text--emphasis-high);
    }

    .section-header-label {
      display: block;
      margin: 0;
      padding: 0;
    }

    .select-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      min-height: 40px;
      border: 1px solid var(--color-border--emphasis-high);
      border-radius: 4px;
      background-color: var(--color-bg--white);
    }

    select {
      width: 100%;
      margin: 0;
      padding: 8px 36px 8px 12px;
      border: 0;
      outline: 0;
      background: transparent;
      color: var(--color-text--emphasis-medium);
      font: inherit;
      appearance: none;
      cursor: pointer;
    }

    option {
      color: var(--color-text--emphasis-medium);
    }

    .select-wrapper > ngm-core-icon {
      position: absolute;
      right: 10px;
      pointer-events: none;
      color: var(--color-primary);
    }

    .horizontal-divider {
      flex: 1;
      border-top: 1px var(--color-border--default) solid;
      margin: 8px -16px;
    }
  `;
}
