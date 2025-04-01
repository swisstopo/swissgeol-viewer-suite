import { customElement, property } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { css, html } from 'lit';
import { PickData } from 'src/features/layer';
import { applyTypography } from 'src/styles/theme';
import { repeat } from 'lit/directives/repeat.js';
import { GeoTIFFLayer, GeoTIFFLayerBand } from 'src/layertree';
import i18next from 'i18next';

@customElement('ngm-layer-tiff-info')
export class LayerTiffInfo extends CoreElement {
  @property({ type: Object })
  accessor data!: PickData;

  private get layer(): GeoTIFFLayer {
    return this.data.layer;
  }

  private readonly handleZoom = () => {
    this.dispatchEvent(new CustomEvent('zoom', { composed: true }));
  };

  readonly render = () => html`
    <ngm-core-button variant="secondary" @click="${this.handleZoom}">
      ${i18next.t('layers:geoTIFF.infoWindow.zoomToObject')}
      <ngm-core-icon icon="zoomPlus"></ngm-core-icon>
    </ngm-core-button>
    <ul>
      ${repeat(this.layer.bands, (band) => band.index, this.renderBandValue)}
    </ul>
  `;

  private readonly renderBandValue = (band: GeoTIFFLayerBand) => html`
    <li>
      <span class="label">
        ${i18next.t(`layers:${this.layer.id}.bands.${band.name}`)}
      </span>
      <span class="value">
        ${this.data.bands[band.index - 1] ?? i18next.t('layers:geoTIFF.noData')}
      </span>
    </li>
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      flex-direction: column;
      width: 320px;
      gap: 16px;
    }

    ngm-core-button {
      width: 100%;
    }

    ul {
      display: flex;
      flex-direction: column;
      list-style: none;
      padding: 0;
      margin: 0;

      ${applyTypography('body-2')};
    }

    /* Band items */

    li {
      display: flex;
      align-items: center;
      padding-block: 12px;
    }

    li:not(:last-child) {
      border-bottom: 1px solid var(--color-border--default);
    }

    li > * {
      flex: 0 0 50%;
    }

    li > .label {
      ${applyTypography('body-2')}
      font-weight: 500;
    }

    li > .value {
      ${applyTypography('body-2')}
    }
  `;
}
