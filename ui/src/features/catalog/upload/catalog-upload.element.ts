import { customElement } from 'lit/decorators.js';
import { css, html, unsafeCSS } from 'lit';
import i18next from 'i18next';
import type { KmlUploadEvent } from './catalog-upload-kml.element';
import { CustomDataSource, Viewer } from 'cesium';
import { parseKml, renderWithDelay } from 'src/cesiumutils';
import MainStore from '../../../store/main';
import { DEFAULT_LAYER_OPACITY, LayerConfig } from 'src/layertree';
import fomanticButtonCss from 'fomantic-ui-css/components/button.css?raw';
import fomanticLoaderCss from 'fomantic-ui-css/components/loader.css?raw';
import { CoreElement, CoreModal } from 'src/features/core';
import { LayerService } from 'src/features/layer/layer.service';
import { consume } from '@lit/context';
import { viewerContext } from 'src/context';

@customElement('ngm-catalog-upload')
export class CatalogUpload extends CoreElement {
  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  @consume({ context: viewerContext })
  accessor viewer!: Viewer;

  private modal: CoreModal | null = null;

  // TODO Cleanup/Refactor this function.
  // As of now, this function remains unchanged to before the navigation-catalog refactoring.
  private async handleKmlUpload(e: KmlUploadEvent): Promise<void> {
    const dataSource = new CustomDataSource();
    const name = await parseKml(
      this.viewer,
      e.detail.file,
      dataSource,
      e.detail.isClampEnabled,
    );
    const layer = `${name.replace(' ', '_')}_${Date.now()}`;

    // name used as id for datasource
    dataSource.name = layer;
    MainStore.addUploadedKmlName(dataSource.name);
    await this.viewer.dataSources.add(dataSource);
    await renderWithDelay(this.viewer);

    // done like this to have correct rerender of component
    const dataSourcePromise = Promise.resolve(dataSource);
    const config: LayerConfig = {
      load() {
        return dataSourcePromise;
      },
      label: name,
      layer,
      promise: dataSourcePromise,
      opacity: DEFAULT_LAYER_OPACITY,
      notSaveToPermalink: true,
      ownKml: true,
      opacityDisabled: true,
    };
    this.layerService.activate(config);
    await this.viewer.zoomTo(dataSource);
    this.requestUpdate();
  }

  private openIonModal(): void {
    this.modal = CoreModal.open(
      { size: 'large', hasNoPadding: true, isOverflowHidden: true },
      html`<ngm-ion-modal @close=${() => this.modal?.close()}></ngm-ion-modal>`,
    );
  }

  readonly render = () => html`
    <ngm-catalog-upload-kml
      @upload=${this.handleKmlUpload}
    ></ngm-catalog-upload-kml>
    <ngm-core-button
      variant="tertiary"
      shape="large"
      justify="start"
      @click=${this.openIonModal}
    >
      <ngm-core-icon icon="cesium"></ngm-core-icon>
      ${i18next.t('catalog:add_content_from_cesium_ion')}
    </ngm-core-button>
  `;

  static readonly styles = css`
    ${unsafeCSS(fomanticButtonCss)}
    ${unsafeCSS(fomanticLoaderCss)}
    :host, :host * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 6px;
    }

    :host > * {
      width: 100%;
    }
  `;
}
