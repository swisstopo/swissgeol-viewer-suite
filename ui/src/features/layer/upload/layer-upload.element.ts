import { customElement, property, state } from 'lit/decorators.js';
import { LitElementI18n } from 'src/i18n';
import { css, html, unsafeCSS } from 'lit';
import i18next from 'i18next';
import type { KmlUploadEvent } from './layer-upload-kml.element';
import { CustomDataSource, Viewer } from 'cesium';
import { parseKml, renderWithDelay } from 'src/cesiumutils';
import MainStore from '../../../store/main';
import { DEFAULT_LAYER_OPACITY, LayerConfig } from 'src/layertree';
import { Subscription } from 'rxjs';
import fomanticButtonCss from 'fomantic-ui-css/components/button.css?raw';
import fomanticLoaderCss from 'fomantic-ui-css/components/loader.css?raw';
import { CoreModal } from 'src/features/core';
import { LayerService } from 'src/features/layer/layer.service';
import { consume } from '@lit/context';

@customElement('ngm-layer-upload')
export class LayerUpload extends LitElementI18n {
  @property({ type: Object })
  accessor toastPlaceholder!: HTMLElement;

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  @state()
  private accessor viewer: Viewer | null = null;

  private modal: CoreModal | null = null;

  private readonly subscription = new Subscription();

  connectedCallback() {
    super.connectedCallback();
    this.subscription.add(
      MainStore.viewer.subscribe((viewer) => {
        this.viewer = viewer;
      }),
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.subscription.unsubscribe();
  }

  // TODO Cleanup/Refactor this function.
  // As of now, this function remains unchanged to before the navigation-catalog refactoring.
  private async handleKmlUpload(e: KmlUploadEvent): Promise<void> {
    if (this.viewer == null) {
      return;
    }

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
    <ngm-layer-upload-kml
      .toastPlaceholder=${this.toastPlaceholder}
      @upload=${this.handleKmlUpload}
    >
    </ngm-layer-upload-kml>
    <ngm-core-button
      variant="tertiary"
      shape="large"
      justify="start"
      @click=${this.openIonModal}
    >
      <ngm-core-icon icon="cesium"></ngm-core-icon>
      ${i18next.t('dtd_add_ion_token')}
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
