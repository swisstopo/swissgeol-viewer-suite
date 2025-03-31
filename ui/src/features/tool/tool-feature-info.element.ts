import { CoreElement } from 'src/features/core';
import { customElement, property } from 'lit/decorators.js';
import { Feature, Shape } from 'src/features/tool/tool.model';
import { css, html, PropertyValues } from 'lit';
import { consume } from '@lit/context';
import { ToolService } from 'src/features/tool/tool.service';
import interact from 'interactjs';
import { applyTypography } from 'src/styles/theme';
import i18next from 'i18next';
import { GeometryService } from 'src/features/tool/geometry.service';
import { flyToGeom } from 'src/toolbox/helpers';

@customElement('ngm-tool-feature-info')
export class ToolFeatureInfo extends CoreElement {
  @property({ type: Object })
  accessor feature!: Feature;

  @consume({ context: ToolService.context() })
  accessor toolService!: ToolService;

  @consume({ context: GeometryService.context() })
  accessor geometryService!: GeometryService;

  private hasConnected = false;

  constructor() {
    super();

    this.handleDrag = this.handleDrag.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    this.hasConnected = true;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }

  protected updated(_changedProperties: PropertyValues) {
    super.updated(_changedProperties);

    if (this.hasConnected) {
      this.hasConnected = false;
      this.initializeDrag();
    }
  }

  private initializeDrag(): void {
    const parent = this.parentElement!.getBoundingClientRect();
    const bounds = this!.getBoundingClientRect();

    this.dataset.x = `${parent.width - bounds.width - INITIAL_OFFSET_X_PX}`;
    this.dataset.y = `${INITIAL_OFFSET_Y_PX}`;
    interact(this).draggable({
      inertia: true,
      modifiers: [
        interact.modifiers.restrictRect({
          restriction: 'parent',
        }),
      ],
      onmove: this.handleDrag,
    });

    console.log({
      parent: parent.width,
      self: bounds.width,
      offset: INITIAL_OFFSET_X_PX,
      total: parent.width - bounds.width - INITIAL_OFFSET_X_PX,
    });

    this.handleDrag({ dx: 0, dy: 0 });
    super.connectedCallback();
  }

  private close() {
    this.dispatchEvent(new CustomEvent('close'));
  }

  private handleDrag(event: { dx: number; dy: number }) {
    // keep the dragged position in the data-x/data-y attributes
    const x = (parseFloat(this.getAttribute('data-x') ?? '') || 0) + event.dx;
    const y = (parseFloat(this.getAttribute('data-y') ?? '') || 0) + event.dy;

    // translate the element
    this.style.transform = `translate(${x}px, ${y}px)`;

    // update the position attributes
    this.setAttribute('data-x', `${x}`);
    this.setAttribute('data-y', `${y}`);
  }

  private handleZoom(): void {
    const entity = this.toolService.getEntityOfFeature(this.feature);
    flyToGeom()
  }

  readonly render = () => html`
    <div class="heading">
      <h4>${this.toolService.getNameOfFeature(this.feature)}</h4>

      <ngm-core-button variant="tertiary" shape="icon" transparent borderless @click="${this.close}">
        <ngm-core-icon icon="close"></ngm-core-icon>
      </ngm-core-button>
    </div>

    <div class="actions-container">
      <div class="actions">
        <ngm-core-button variant="tertiary" shape="icon" transparent>
          <ngm-core-icon icon="slice"></ngm-core-icon>
        </ngm-core-button>
        <ngm-core-button variant="tertiary" shape="icon" transparent>
          <ngm-core-icon icon="edit"></ngm-core-icon>
        </ngm-core-button>
        <ngm-core-button variant="tertiary" shape="icon" transparent>
          <ngm-core-icon icon="download"></ngm-core-icon>
        </ngm-core-button>
        <ngm-core-button variant="tertiary" shape="icon" transparent @click="${this.handleZoom}">
          <ngm-core-icon icon="zoomPlus"></ngm-core-icon>
        </ngm-core-button>
      </div>
      <hr />
    </div>

    ${this.renderAttribute('shape', this.feature.geometry.shape, (shape) =>
      i18next.t(`tool.shapes.${shape}`, { ns: 'features' }),
    )}
    ${this.renderAttribute('description', this.feature.description)} ${this.renderAttribute('url', this.feature.url)}
    ${this.feature.geometry.shape === Shape.Point
      ? html`
          <!-- TODO whatever these are -->
          <div class="attribute-row">
            ${this.renderAttribute('lowerBound', this.feature.lowerBound, (value) => value.toFixed(1))}
            ${this.renderAttribute('distanceToTerrain', this.feature.distanceToTerrain, (value) => value.toFixed(1))}
          </div>
        `
      : ''}
    ${this.renderAttribute(
      'area',
      this.geometryService.getArea(this.feature.geometry),
      (area) => `${area.toFixed(1)}km²`,
    )}
    ${this.renderAttribute(
      'length',
      this.geometryService.getLength(this.feature.geometry),
      (length) => `${(length / 1000).toFixed(3)}km`,
    )}
    ${this.renderAttribute(
      'perimeter',
      this.geometryService.getPerimeter(this.feature.geometry),
      (length) => `${(length / 1000).toFixed(3)}km`,
    )}
    ${this.feature.geometry.shape !== Shape.Point
      ? this.renderAttribute('numberOfSegments', this.feature.geometry.coordinates.length)
      : ''}
  `;

  private readonly renderAttribute = <T>(name: string, value: T | null | undefined, render?: (value: T) => unknown) => {
    return html`
      <div class="attribute">
        <span class="title">${i18next.t(`tool.feature.attribute_names.${name}`, { ns: 'features' })}</span>
        ${this.renderAttributeValue(value, render)}
      </div>
    `;
  };

  private readonly renderAttributeValue = <T>(value: T | null | undefined, render?: (value: T) => unknown) => {
    const renderedValue = value == null ? '-' : render === undefined ? value : render(value);
    return html`
      <span class="value">${renderedValue}</span>
    `;
  };

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      position: absolute;
      display: flex;
      flex-direction: column;
      gap: 24px;
      padding: 16px;
      width: 317px;
      border-radius: 4px;
      background-color: var(--color-bg--grey);
      transform-origin: 0 0;
      z-index: 4;
    }

    /* heading */

    .heading {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 12px 5px 16px;
      border-bottom: 1px solid #e0e2e6;
    }

    .heading > h4 {
      ${applyTypography('body-1-bold')};
      color: var(--color-text--emphasis-high);
      margin: 0;
    }

    /* actions */

    .actions-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
      border-radius: 4px;
      padding: 6px 6px 0 6px;
      background-color: var(--color-bg--white);
      border: 1px solid var(--color-border--default);
    }

    .actions {
      display: flex;
      gap: 6px;
      color: var(--color-text--emphasis-high);
    }

    /* hr */

    hr {
      width: 273px;
      height: 1px;
      border-width: 0;
      color: var(--color-border--default);
      background-color: var(--color-border--default);
      margin: 0;
    }

    /* attribute */
    .attribute {
      display: flex;
      flex-direction: column;
      gap: 6px;
      border-radius: 3px;
    }

    .attribute > .title {
      ${applyTypography('body-2-medium')}
      color: var(--color-text--emphasis-high);
      padding-left: 11px;
    }

    .attribute > .value {
      ${applyTypography('body-1')}
      padding: 9px 12px;
      border: 1px solid var(--color-border--default);
      border-radius: 3px;
    }

    .attribute-row {
      display: flex;
      gap: 24px;
    }
  `;
}

const INITIAL_OFFSET_X_PX = 64;
const INITIAL_OFFSET_Y_PX = 10;
