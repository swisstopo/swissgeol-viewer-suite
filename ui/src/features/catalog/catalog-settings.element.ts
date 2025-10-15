import { customElement, state } from 'lit/decorators.js';
import {
  CustomDataSource,
  DataSource,
  DataSourceCollection,
  Viewer,
} from 'cesium';
import MainStore from 'src/store/main';
import { css, html } from 'lit';
import i18next from 'i18next';
import { debounce } from 'src/utils';
import { setExaggeration } from 'src/permalink';
import NavToolsStore from 'src/store/navTools';
import { updateExaggerationForKmlDataSource } from 'src/cesiumutils';
import '../core';
import { SliderChangeEvent } from 'src/features/core/core-slider.element';
import { viewerContext } from 'src/context';
import { consume } from '@lit/context';
import { CoreElement, tooltip } from 'src/features/core';

@customElement('ngm-catalog-settings')
export class LayerOptions extends CoreElement {
  @consume({ context: viewerContext })
  accessor viewer!: Viewer;

  @state()
  private accessor exaggeration: number = 1;

  @state()
  private accessor isExaggerationHidden = false;

  private prevExaggeration: number = 1;

  connectedCallback() {
    super.connectedCallback();

    this.exaggeration = this.viewer?.scene.verticalExaggeration ?? 1;
    this.prevExaggeration = this.exaggeration;

    const handleDataSourceAdded = (
      _collection: DataSourceCollection,
      dataSource: DataSource | CustomDataSource,
    ) => {
      if (MainStore.uploadedKmlNames.includes(dataSource.name)) {
        const exaggeration = this.isExaggerationHidden ? 1 : this.exaggeration;
        updateExaggerationForKmlDataSource(dataSource, exaggeration, 1);
      }
    };
    this.viewer.dataSources.dataSourceAdded.addEventListener(
      handleDataSourceAdded,
    );
    this.register(() =>
      this.viewer.dataSources.dataSourceAdded.removeEventListener(
        handleDataSourceAdded,
      ),
    );
  }

  private toggleExaggerationVisibility() {
    this.isExaggerationHidden = !this.isExaggerationHidden;
    const exaggeration = this.isExaggerationHidden ? 1 : this.exaggeration;
    this.viewer.scene.verticalExaggeration = exaggeration;
    this.updateExaggerationForKmls();
    NavToolsStore.exaggerationChanged.next(exaggeration);
    this.viewer.scene.requestRender();
  }

  private updateExaggerationForKmls() {
    const exaggeration = this.isExaggerationHidden ? 1 : this.exaggeration;
    for (const name of MainStore.uploadedKmlNames) {
      const dataSource = this.viewer?.dataSources.getByName(name)[0];
      updateExaggerationForKmlDataSource(
        dataSource,
        exaggeration,
        this.prevExaggeration,
      );
    }
    this.prevExaggeration = exaggeration;
    this.viewer?.scene.requestRender();
  }

  private updateExaggeration(event: SliderChangeEvent) {
    if (this.viewer == null) {
      return;
    }
    this.isExaggerationHidden = false;
    this.exaggeration = event.detail.value;
    this.viewer.scene.verticalExaggeration = this.exaggeration;
    // workaround for billboards positioning
    setTimeout(() => this.viewer!.scene.requestRender(), 500);
    setExaggeration(this.exaggeration);
    NavToolsStore.exaggerationChanged.next(this.exaggeration);
  }

  readonly render = () => html`
    <div class="group">
      <ngm-core-button
        transparent
        variant="tertiary"
        shape="icon"
        data-cy="visibility"
        @click="${this.toggleExaggerationVisibility}"
      >
        <ngm-core-icon
          icon="${this.isExaggerationHidden ? 'hidden' : 'visible'}"
        ></ngm-core-icon>
      </ngm-core-button>
      ${tooltip(
        this.isExaggerationHidden
          ? i18next.t('catalog:exaggeration.show')
          : i18next.t('catalog:exaggeration.hide'),
      )}
      <label>${i18next.t('catalog:exaggeration.title')}</label>
    </div>
    <hr />
    <div class="group">
      <ngm-core-slider
        data-cy="exaggeration-slider"
        .min="${1}"
        .max="${10}"
        .step="${0.5}"
        .value="${this.exaggeration}"
        @change=${this.updateExaggeration}
        @done="${debounce(() => this.updateExaggerationForKmls(), 300)}"
      ></ngm-core-slider>
      <div class="chip-container">
        <ngm-core-chip data-cy="exaggeration-factor"
          >${this.exaggeration}x</ngm-core-chip
        >
      </div>
    </div>
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      flex-direction: column;
      justify-content: center;
      background-color: var(--color-bg--white);
      box-sizing: border-box;
      border: 1px solid var(--color-border--default);
      border-radius: 4px;
    }

    hr {
      margin: 0 10px;
      height: 1px;
      border-width: 0;
      color: var(--color-border--default);
      background-color: var(--color-border--default);
    }

    .group {
      display: flex;
      justify-content: flex-start;
      gap: 6px;
      align-items: center;
      margin: 10px;
    }

    .chip-container {
      min-width: 48px;
      display: flex;
      justify-content: flex-end;
    }

    .chip-container > ngm-core-chip {
      min-width: 40px;
    }
  `;
}
