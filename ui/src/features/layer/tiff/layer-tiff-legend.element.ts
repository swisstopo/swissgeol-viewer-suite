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

  willUpdate(changedProps: PropertyValues<this>) {
    super.willUpdate(changedProps);
    if (changedProps.has('display')) {
      this.initialize();
    }
  }

  private initialize(): void {
    // Compute the legend's background gradient.
    this.gradientCss = this.makeGradient();
    console.log(this.gradientCss);

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
    const values = [...this.display.steps!] as
      | string[]
      | Array<{ value: number; label: string } | number>;
    if (this.display.stepDirection === 'desc') {
      values.reverse();
    }

    const [base, offset] = run(() => {
      const n = values.length;
      if (this.display.isDiscrete) {
        if (n === 1) return [1, 0.5]; // only step at center
        const base = 1 / n;
        return [base, base / 2];
      }
      return [1 / (n - 1), 0];
    });
    return values.map(
      (
        step: { value: number; label: string } | number | string,
        i: number,
      ): Step => ({
        value: typeof step === 'object' ? step.label : step,
        percentage: base * i + offset,
      }),
    );
  }

  private makeGradient(): string {
    const originalColors = Object.values(this.display.colorMap.definition);
    const mappedColors =
      this.display.steps === undefined ||
      typeof this.display.steps[0] === 'string'
        ? originalColors
        : remapColors(
            originalColors,
            this.display.steps as Array<
              { value: number; label: string } | number
            >,
            this.display.bounds,
          );

    const colors = mappedColors.map((rgba) => {
      const args = rgba.join(',');
      return rgba.length === 3 ? `rgb(${args})` : `rgba(${args})`;
    });
    if (this.display.stepDirection === 'desc') {
      colors.reverse();
    }
    if (this.display.isDiscrete) {
      const feather = 10; // total blend width in percent
      const round3 = (x: number) => Number(x.toFixed(3));

      const percentage = 100 / colors.length;
      const half = Math.min(feather / 2, percentage / 2); // avoid overlap

      const stops = [] as string[];
      stops.push(`${colors[0]} 0%`);

      for (let i = 0; i < colors.length - 1; i++) {
        const b = percentage * (i + 1); // boundary between i and i+1
        const before = round3(b - half);
        const after = round3(b + half);

        stops.push(`${colors[i]} ${before}%`);
        stops.push(`${colors[i + 1]} ${after}%`);
      }

      stops.push(`${colors[colors.length - 1]} 100%`);
      return `linear-gradient(to bottom, ${stops.join(', ')})`;
    }
    return `linear-gradient(to bottom, ${colors.join(', ')})`;
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
      width: 200px;
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
  steps: Array<{ value: number; label: string } | number>,
  bounds: [number, number],
): number[][] => {
  const getValue = (
    value: { value: number; label: string } | number,
  ): number => {
    if (typeof value === 'number') {
      return value;
    }
    return value.value;
  };

  const segments = steps.length - 1;
  const colorsPerSegment = Math.floor(originalColors.length / segments);
  const newColors: number[][] = [];

  for (let i = 0; i < segments; i++) {
    const start = getValue(steps[i]);
    const end = getValue(steps[i + 1]);

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
