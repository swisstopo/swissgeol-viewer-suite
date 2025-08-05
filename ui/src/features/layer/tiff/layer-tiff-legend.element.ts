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
  private steps: Step[] = [];

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
    const originalColors = Object.values(this.display.colorMap.definition);
    const mappedColors =
      this.display.steps === undefined
        ? originalColors
        : remapColors(originalColors, this.display.steps, this.display.bounds);

    // Compute the legend's background gradient.
    const colors = mappedColors.map((rgba) => {
      const args = rgba.join(',');
      return rgba.length === 3 ? `rgb(${args})` : `rgba(${args})`;
    });
    if (this.display.stepDirection === 'desc') {
      colors.reverse();
    }
    this.gradientCss = `linear-gradient(to bottom, ${colors.join(', ')})`;

    // Calculate the steps that will be shown on the legend.
    this.steps =
      this.display.steps === undefined
        ? this.makeStepsFromBounds()
        : this.makeCustomSteps();

    this.steps.reverse();
  }

  private makeStepsFromBounds(): Step[] {
    const [min, max] = this.display.bounds;
    const step = (max - min) / 5;
    const base = 1 / 5;
    return Array.from({ length: 6 }, (_, i) => ({
      percentage: base * i,
      value: Math.round(min + step * i),
    }));
  }

  private makeCustomSteps(): Step[] {
    const [min, max] = this.display.bounds;
    const values = [...this.display.steps!];
    const [minIndex, maxIndex] = run(() => {
      if (this.display.stepDirection === 'desc') {
        values.reverse();
        return [values.length - 1, 0];
      }
      return [0, values.length - 1];
    });

    const base = 1 / (values.length - 1);
    const steps: Step[] = values.map((step, i) => ({
      value: step,
      percentage: base * i,
    }));
    if (values[minIndex] !== min) {
      steps[minIndex].value = `< ${values[minIndex]}`;
    }
    if (values[maxIndex] !== max) {
      steps[maxIndex].value = `> ${values[maxIndex]}`;
    }
    return steps;
  }

  readonly render = () => html`
    <div class="title">${i18next.t('layers:geoTIFF.bandsWindow.legend')}</div>
    <div class="range">
      <div class="gradient" style="background: ${this.gradientCss}"></div>
      ${this.steps.map(
        (step) => html`
          <div class="step" style="--step-percentage: ${step.percentage}">
            ${step.value}
          </div>
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
      top: calc((100% - 1px) * var(--step-percentage));
      left: calc(60px);
      padding-inline: 8px;
      height: 20px;
      margin-top: -10px;
      white-space: nowrap;
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

interface Step {
  value: number | string;
  percentage: number;
}

const remapColors = (
  originalColors: number[][],
  steps: number[],
  bounds: [number, number],
): number[][] => {
  const segments = steps.length - 1;
  const colorsPerSegment = Math.floor(originalColors.length / segments);
  const newColors: number[][] = [];

  for (let i = 0; i < segments; i++) {
    const start = steps[i];
    const end = steps[i + 1];

    for (let j = 0; j < colorsPerSegment; j++) {
      const t = j / (colorsPerSegment - 1);
      const value = start + t * (end - start);
      const normalized = (value - bounds[0]) / (bounds[1] - bounds[0]);

      const pos = normalized * (originalColors.length - 1);
      const lower = Math.floor(pos);
      const upper = Math.min(lower + 1, originalColors.length - 1);
      const frac = pos - lower;

      const interpolated: number[] = [0, 0, 0, 0];
      for (let k = 0; k < 4; k++) {
        interpolated[k] =
          originalColors[lower][k] * (1 - frac) +
          originalColors[upper][k] * frac;
      }

      newColors.push(interpolated);
    }
  }

  while (newColors.length < originalColors.length) {
    newColors.push([...originalColors[originalColors.length - 1]]);
  }
  if (newColors.length > originalColors.length) {
    newColors.length = originalColors.length;
  }

  return newColors;
};
