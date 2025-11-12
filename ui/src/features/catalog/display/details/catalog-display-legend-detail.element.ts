import { css, html } from 'lit';
import { until } from 'lit/directives/until.js';
import { customElement, property, state } from 'lit/decorators.js';
import i18next from 'i18next';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { classMap } from 'lit/directives/class-map.js';
import { CoreElement } from 'src/features/core';
import { Layer } from 'src/features/layer';
import { choose } from 'lit/directives/choose.js';
import { run } from 'src/utils/fn.utils';
import { Id } from 'src/models/id.model';
import { LayerService } from 'src/features/layer/layer.service';
import { consume } from '@lit/context';

@customElement('ngm-catalog-display-legend-detail')
export class CatalogDisplayLegend extends CoreElement {
  @property()
  accessor layerId!: Id<Layer>;

  @state()
  accessor layer!: Layer;

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  connectedCallback(): void {
    super.connectedCallback();

    this.register(
      this.layerService.layer$(this.layerId).subscribe((layer) => {
        this.layer = layer;
      }),
    );
  }

  render() {
    return html`
      <div
        class="content-container ${classMap({
          'legend-html': this.layer.legend === true,
        })}"
      >
        ${choose(
          this.layer.legend,
          [
            [true, this.renderLegendAsHtml],
            [null, () => undefined],
          ],
          this.renderLegendAsPng,
        )}
      </div>
    `;
  }

  private readonly renderLegendAsPng = () => html`
    <div class="ngm-legend-container">
      <div>${i18next.t('catalog:display.legend')}</div>
      <div class="ngm-legend-image">
        <img
          src="https://api.geo.admin.ch/static/images/legends/${this.layer
            .legend}_${i18next.language}.png"
        />
      </div>
    </div>
  `;

  private readonly renderLegendAsHtml = () => {
    const htmlPromise = run(async () => {
      const response = await fetch(
        `https://api3.geo.admin.ch/rest/services/api/MapServer/${this.layer.id}/legend?lang=${i18next.language}`,
      );
      const text = await response.text();
      return html`<div class="html-legend">${unsafeHTML(text)}</div>`;
    });
    return until(htmlPromise, html`<div class="ui loader"></div>`);
  };

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      user-select: text;
    }

    /* html legend */
    .html-legend .bod-title {
      margin-top: 0;
    }

    .html-legend table {
      border-collapse: collapse;
      border-spacing: 0;
    }

    .html-legend table td:first-child {
      padding-right: 16px;
    }

    .html-legend table a {
      color: #357183;
    }

    .html-legend span,
    .html-legend p.bod-title {
      font-weight: bold;
    }

    .html-legend img {
      width: 200px;
    }

    html-legend .ui.divider {
      margin: 10px 0 0 0;
    }

    .html-legend .content-container {
    }
  `;
}
