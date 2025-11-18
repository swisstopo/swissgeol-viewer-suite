import { customElement } from 'lit/decorators.js';
import { css, html, unsafeCSS } from 'lit';
import i18next from 'i18next';
import type { KmlUploadEvent } from './catalog-upload-kml.element';
import fomanticButtonCss from 'fomantic-ui-css/components/button.css?raw';
import fomanticLoaderCss from 'fomantic-ui-css/components/loader.css?raw';
import { CoreElement, CoreModal } from 'src/features/core';
import { LayerService } from 'src/features/layer/layer.service';
import { consume } from '@lit/context';
import { KmlLayer, LayerType } from 'src/features/layer';
import { makeId } from 'src/models/id.model';

@customElement('ngm-catalog-upload')
export class CatalogUpload extends CoreElement {
  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  private modal: CoreModal | null = null;

  private async handleKmlUpload(e: KmlUploadEvent): Promise<void> {
    this.layerService.activateCustomLayer({
      id: makeId(crypto.randomUUID()),
      type: LayerType.Kml,
      source: e.detail.file,
      shouldClampToGround: e.detail.isClampEnabled,
      label: null,
      opacity: 1,
      canUpdateOpacity: false,
      isVisible: true,
      geocatId: null,
      downloadUrl: null,
      legend: null,
      isLocal: true,
    } satisfies KmlLayer);
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
