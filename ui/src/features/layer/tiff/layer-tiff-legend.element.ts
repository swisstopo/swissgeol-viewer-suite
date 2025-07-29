import { customElement, property } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { css, html, PropertyValues } from 'lit';
import { GeoTIFFDisplay, GeoTIFFLayer } from 'src/layertree';
import i18next from 'i18next';
import { applyTypography } from 'src/styles/theme';
import { run } from 'src/utils/fn.utils';

@customElement('ngm-layer-tiff-legend')
export class LayerTiffLegend extends CoreElement {
  @property({ type: Object })
  accessor layer!: GeoTIFFLayer;

  @property({ type: Object })
  accessor display!: GeoTIFFDisplay;

  private gradientCss = '';
  private steps: number[] = [];

  connectedCallback() {
    super.connectedCallback();
  }

  willUpdate(changedProps: PropertyValues<this>) {
    super.willUpdate(changedProps);
    if (changedProps.has('display')) {
      this.initialize();
    }
  }

  private initialize(): void {
    // Compute the legend's background gradient.
    const colors = Object.values(this.display.colorMap.definition).map(
      (rgba) => {
        const args = rgba.join(',');
        return rgba.length === 3 ? `rgb(${args})` : `rgba(${args})`;
      },
    );
    colors.reverse();
    this.gradientCss = `linear-gradient(to bottom, ${colors.join(', ')})`;

    // Calculate the steps that will be shown on the legend.
    this.steps = run(() => {
      const [min, max] = this.display.bounds;
      const step = (max - min) / 5;
      return Array.from({ length: 6 }, (_, i) => Math.round(min + step * i));
    });
  }

  readonly render = () => html`
    <div class="title">${i18next.t('layers:geoTIFF.bandsWindow.legend')}</div>
    <div class="range">
      <div class="gradient" style="background: ${this.gradientCss}"></div>
      ${this.steps.map(
        (step, i) => html`
          <div class="step" style="--step-index: ${i}">${step}</div>
        `,
      )}
    </div>
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      position: absolute;
      top: 0;
      right: 0;
      height: 100%;
      width: 161px;
      padding: 16px;

      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;

      border-left: 1px solid var(--sgc-color-border--default);

      background-color: var(--sgc-color-bg--grey);
    }

    .title {
      width: 100%;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--sgc-color-border--emphasis-high);

      text-align: center;
      ${applyTypography('body-2-bold')};
    }

    .range {
      position: relative;
      height: 100%;
      min-height: 300px;
      width: 100px;
    }

    .gradient {
      width: 40px;
      height: 100%;
    }

    .step {
      --step-size: calc((100% - 1px) / 5);

      position: absolute;
      top: calc(var(--step-size) * var(--step-index));
      left: calc(60px);
      padding-inline: 8px;
      height: 20px;
      margin-top: -10px;
    }

    .step::before {
      display: block;
      content: ' ';
      background-color: var(--sgc-color-secondary--900);
      height: 1px;
      width: 36px;

      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      right: 100%;
    }
  `;
}
