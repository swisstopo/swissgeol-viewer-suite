import { consume } from '@lit/context';
import i18next from 'i18next';
import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import {
  getLayerLabel,
  Layer,
  LayerService,
  LayerType,
  WmtsLayer,
} from 'src/features/layer';
import { Id } from 'src/models/id.model';

type LexicLayerOption = {
  id: string;
  name: string;
};

@customElement('ngm-lexic')
export class Lexic extends CoreElement {
  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  @state()
  accessor layerOptions: LexicLayerOption[] = [];

  @state()
  accessor selectedLayerId = '';

  @state()
  accessor isLoadingLayers = false;

  connectedCallback(): void {
    super.connectedCallback();

    this.register(
      this.layerService.activeLayerIds$.subscribe((ids) => {
        const activeLexicLayerId = ids.find((id) => this.isLexicWmtsLayer(id));
        this.selectedLayerId =
          activeLexicLayerId != null ? String(activeLexicLayerId) : '';
      }),
    );

    void this.loadLayerOptions();
  }

  willChangeLanguage(_language: void): void {
    void this.loadLayerOptions();
  }

  private readonly handleLayerSelection = (event: Event) => {
    const selectElement = event.target as HTMLSelectElement;
    this.selectedLayerId = selectElement.value;
    this.applySelectionToViewer();
  };

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
        ${i18next.t('layout:lexic.datasetLabel')}
      </div>
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
            (layer) => html`<option value="${layer.id}">${layer.name}</option>`,
          )}
        </select>
        <ngm-core-icon icon="dropdown"></ngm-core-icon>
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
      background-color: var(--color-bg--blue);
      color: var(--color-text--emphasis-medium);
      font-size: 12px;
      font-weight: 600;
      padding: 8px 12px;
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
      color: var(--color-text--emphasis-high);
      font: inherit;
      appearance: none;
      cursor: pointer;
    }

    .select-wrapper > ngm-core-icon {
      position: absolute;
      right: 12px;
      pointer-events: none;
      color: var(--color-text--emphasis-medium);
    }
  `;
}
