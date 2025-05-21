import { customElement, property } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { css, html, PropertyValues } from 'lit';
import { GeoTIFFLayer, GeoTIFFLayerBand } from 'src/layertree';
import { repeat } from 'lit/directives/repeat.js';
import { applyTypography } from 'src/styles/theme';
import { LayerTiffController } from 'src/features/layer';

@customElement('ngm-layer-tiff-bands')
export class LayerTiffBands extends CoreElement {
  @property({ type: Object })
  accessor layer!: GeoTIFFLayer;

  private controller!: LayerTiffController;

  private readonly handleBandClick = (band: GeoTIFFLayerBand): void => {
    this.controller.activateBand(band.index);
    this.requestUpdate();
  };

  connectedCallback() {
    super.connectedCallback();
    this.updateController();
  }

  willUpdate(props: PropertyValues<this>): void {
    super.willUpdate(props);
    this.updateController();
  }

  private updateController(): void {
    if (this.layer.controller == null) {
      throw new Error(
        `GeoTIFFLayer is missing a controller: ${this.layer.label}`,
      );
    }
    this.controller = this.layer.controller!;
  }

  readonly render = () => html`
    <ul>
      ${repeat(this.layer.bands, (band) => band.index, this.renderBand)}
    </ul>
  `;

  readonly renderBand = (band: GeoTIFFLayerBand) => html`
    <li>
      <ngm-core-radio
        .isActive="${this.controller.activeBand === band}"
        ?disabled="${band.display === undefined}"
        @click="${() => this.handleBandClick(band)}"
      >
        ${band.name}
      </ngm-core-radio>
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
    }

    ul {
      display: flex;
      flex-direction: column;
      gap: 12px;

      list-style: none;
      padding: 0;
      margin: 0;

      ${applyTypography('body-2')};
      color: var(--color-primary);
    }
  `;
}
