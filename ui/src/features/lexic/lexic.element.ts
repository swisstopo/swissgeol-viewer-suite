import { consume } from '@lit/context';
import i18next from 'i18next';
import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { applyTypography } from 'src/styles/theme';
import {
  getLayerLabel,
  Layer,
  LayerService,
  LayerType,
  WmtsLayer,
} from 'src/features/layer';
import { Id } from 'src/models/id.model';
import { LexicApiService } from './lexic-api.service';
import { LexicLanguage, LexicLayerFiltersResponse } from './lexic-api.model';

type LexicLayerOption = {
  id: string;
  name: string;
};

@customElement('ngm-lexic')
export class Lexic extends CoreElement {
  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  @consume({ context: LexicApiService.context() })
  accessor lexicApiService!: LexicApiService;

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
      this.layerService.activeLayerIds$.subscribe((ids) => {
        const activeLexicLayerId = ids.find((id) => this.isLexicWmtsLayer(id));
        const nextSelectedLayerId =
          activeLexicLayerId != null ? String(activeLexicLayerId) : '';
        if (this.selectedLayerId === nextSelectedLayerId) {
          return;
        }

        this.selectedLayerId = nextSelectedLayerId;
        void this.loadSupportedFiltersForSelectedLayer();
      }),
    );

    void this.loadLayerOptions();
  }

  willChangeLanguage(_language: void): void {
    void this.loadLayerOptions();
    void this.loadSupportedFiltersForSelectedLayer();
  }

  private readonly handleLayerSelection = (event: Event) => {
    const selectElement = event.target as HTMLSelectElement;
    this.selectedLayerId = selectElement.value;
    this.applySelectionToViewer();
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

  private readonly isLexicWmtsLayer = (id: Id<Layer>): boolean => {
    const layer = this.layerService.layerOrNull(id);
    return layer?.type === LayerType.Wmts && layer.service === 'lexic';
  };

  private applySelectionToViewer(): void {
    const selectedLayerId =
      this.selectedLayerId === ''
        ? null
        : (this.selectedLayerId as unknown as Id<Layer>);

    // Keep non-Lexic layers untouched, but ensure only one Lexic layer stays active.
    this.layerService.activeLayerIds
      .filter((id) => this.isLexicWmtsLayer(id) && id !== selectedLayerId)
      .forEach((id) => this.layerService.deactivate(id));

    if (selectedLayerId != null) {
      this.layerService.activate(selectedLayerId);
    }
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
        layerId,
        this.getLexicLanguage(),
      );

      if (
        this.filtersRequestVersion === requestVersion &&
        this.selectedLayerId === layerId
      ) {
        this.selectedLayerFilters = filters;
      }
    } catch {
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

      if (
        !this.layerOptions.some((layer) => layer.id === this.selectedLayerId)
      ) {
        this.selectedLayerId = '';
      }
    } catch {
      this.layerOptions = [];
      this.selectedLayerId = '';
    } finally {
      this.isLoadingLayers = false;
    }
  }

  readonly render = () => html`
    <section>
      <div class="section-header">
        <span class="section-header-label"
          >${i18next.t('layout:lexic.datasetLabel')}</span
        >
      </div>
      <div class="select-container">
        <div class="select-wrapper">
          <select
            .value=${this.selectedLayerId}
            @change=${this.handleLayerSelection}
          >
            <option value="">
              ${this.isLoadingLayers
                ? i18next.t('layout:lexic.loadingLayers')
                : i18next.t('layout:lexic.layerPlaceholder')}
            </option>
            ${this.layerOptions.map(
              (layer) =>
                html`<option value="${layer.id}">${layer.name}</option>`,
            )}
          </select>
          <ngm-core-icon icon="dropdown"></ngm-core-icon>
        </div>
      </div>
    </section>
  `;

  static readonly styles = css`
    :host {
      display: block;
      color: var(--color-text--emphasis-high);
    }

    section {
      display: flex;
      flex-direction: column;
      gap: 0;
      border: 1px solid var(--color-border--emphasis-high);
      border-radius: 4px;
      overflow: hidden;
    }

    .section-header {
      ${applyTypography('body-2-bold')};
      display: flex;
      align-items: center;
      min-height: 44px;
      background-color: var(--color-bg--blue);
      color: var(--color-text--emphasis-medium);
      padding: 12px 16px;
      border-bottom: 1px solid var(--color-border--default);
    }

    .section-header-label {
      display: block;
      margin: 0;
      padding: 0;
    }

    .select-container {
      padding: 24px 16px;
      background-color: var(--color-bg--white);
    }

    .select-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      min-height: 44px;
      background-color: var(--color-bg--white);
    }

    select {
      width: 100%;
      margin: 0;
      padding: 10px 40px 10px 12px;
      border: 0;
      outline: 0;
      background: transparent;
      color: var(--color-primary);
      font: inherit;
      appearance: none;
      cursor: pointer;
    }

    option {
      color: var(--color-primary);
    }

    .select-wrapper > ngm-core-icon {
      position: absolute;
      right: 12px;
      pointer-events: none;
      color: var(--color-primary);
    }
  `;
}
