import { css, html, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import {
  FilterOperator,
  getLayerAttributeName,
  VoxelItemMapping,
  VoxelLayer,
  VoxelLayerMapping,
  VoxelLayerMappingType,
  VoxelRangeMapping,
} from 'src/features/layer';
import { repeat } from 'lit/directives/repeat.js';
import { consume } from '@lit/context';
import { LayerService } from 'src/features/layer/new/layer.service';
import { Id } from 'src/models/id.model';
import i18next from 'i18next';
import { applyTypography } from 'src/styles/theme';
import { when } from 'lit/directives/when.js';
import { run } from 'src/utils/fn.utils';

import fomanticInputCss from 'fomantic-ui-css/components/input.css?raw';
import fomanticFormCss from 'fomantic-ui-css/components/form.css?raw';
import { live } from 'lit/directives/live.js';

@customElement('ngm-catalog-display-voxel-filter-detail')
export class CatalogDisplayTimes extends CoreElement {
  @property()
  accessor layerId!: Id<VoxelLayer>;

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  @state()
  accessor layer!: VoxelLayer;

  connectedCallback(): void {
    super.connectedCallback();

    this.register(
      this.layerService.layer$(this.layerId).subscribe((layer) => {
        this.layer = layer;
      }),
    );
  }

  private readonly updateOperator = (newOperator: FilterOperator): void => {
    this.layerService.update(this.layerId, {
      filterOperator: newOperator,
    });
  };

  private readonly toggleMappingItem = (
    index: number,
    itemIndex: number,
  ): void => {
    this.layerService.update(this.layerId, (layer) => {
      const mappings = [...layer.mappings];
      const mapping = mappings[index] as VoxelItemMapping;
      const items = [...mapping.items];
      const item = items[itemIndex];
      items[itemIndex] = {
        ...item,
        isEnabled: !item.isEnabled,
      };
      mappings[index] = {
        ...mapping,
        items,
      };
      return {
        mappings,
      };
    });
  };

  private readonly setAllMappingItems = (
    index: number,
    isEnabled: boolean,
  ): void => {
    this.layerService.update(this.layerId, (layer) => {
      const mappings = [...layer.mappings];
      const mapping = mappings[index] as VoxelItemMapping;
      const items = mapping.items.map((item) => ({ ...item, isEnabled }));
      mappings[index] = {
        ...mapping,
        items,
      };
      return {
        mappings,
      };
    });
  };

  private readonly updateRangeMapping = (
    index: number,
    range: [number | null, number | null],
  ): void => {
    this.layerService.update(this.layerId, (layer) => {
      const mappings = [...layer.mappings];
      const mapping = mappings[index] as VoxelRangeMapping;
      mappings[index] = {
        ...mapping,
        enabledRange: [
          range[0] ?? mapping.range[0],
          range[1] ?? mapping.range[1],
        ],
      };
      return {
        mappings,
      };
    });
  };

  private readonly toggleUndefinedAlwaysEnabled = (index: number): void => {
    this.layerService.update(this.layerId, (layer) => {
      const mappings = [...layer.mappings];
      const mapping = mappings[index] as VoxelRangeMapping;
      mappings[index] = {
        ...mapping,
        isUndefinedAlwaysEnabled: mapping.isUndefinedAlwaysEnabled,
      };
      return {
        mappings,
      };
    });
  };

  readonly render = () => html`
    <ul>
      ${repeat(
        this.layer.mappings,
        (mapping) => mapping.key,
        this.renderMapping,
      )}
    </ul>
  `;

  private readonly renderMapping = (
    mapping: VoxelLayerMapping,
    index: number,
  ) => {
    const operator = when(index === 1, () => this.renderOperators());
    const filter = run(() => {
      switch (mapping.type) {
        case VoxelLayerMappingType.Item:
          return this.renderItemMapping(mapping, index);
        case VoxelLayerMappingType.Range:
          return this.renderRangeMapping(mapping, index);
      }
    });
    return html`${operator} ${filter}`;
  };

  private readonly renderItemMapping = (
    mapping: VoxelItemMapping,
    index: number,
  ) => html`
    <li class="filter is-items ui form">
      <h3>${getLayerAttributeName(this.layer, mapping.key)}</h3>

      <div class="controls">
        <sgc-button
          color="secondary"
          size="small"
          @click="${() => this.setAllMappingItems(index, true)}"
        >
          ${i18next.t('catalog:voxelFilterWindow.items.select_all')}
        </sgc-button>
        <sgc-button
          color="secondary"
          size="small"
          @click="${() => this.setAllMappingItems(index, false)}"
        >
          ${i18next.t('catalog:voxelFilterWindow.items.deselect_all')}
        </sgc-button>
      </div>

      <ul class="items">
        ${repeat(
          mapping.items,
          (item) => item.value,
          (item, i) => {
            const label = i18next.t(item.label);
            return html`
              <label class="is-inline" title="${label}">
                <sgc-checkbox
                  .value="${item.isEnabled}"
                  @checkboxChange=${() => this.toggleMappingItem(index, i)}
                ></sgc-checkbox>
                <div class="color" style="--color: ${item.color}"></div>
                <span class="text">${label}</span>
              </label>
            `;
          },
        )}
      </ul>
    </li>
  `;

  private readonly renderRangeMapping = (
    mapping: VoxelRangeMapping,
    index: number,
  ) => html`
    <li class="filter is-range ui form">
      <h3>${getLayerAttributeName(this.layer, mapping.key)}</h3>
      <div class="fields">
        <label class="field">
          ${i18next.t('catalog:voxelFilterWindow.range.min')}
          <input
            required
            type="number"
            step="0.01"
            value="${live(mapping.enabledRange[0])}"
            min="${mapping.range[0]}"
            max="${mapping.range[1]}"
            @input="${(event: InputEvent) =>
              this.updateRangeMapping(index, [
                (event.target as HTMLInputElement).valueAsNumber,
                null,
              ])}"
          />
        </label>
        <label class="field">
          ${i18next.t('catalog:voxelFilterWindow.range.max')}
          <input
            required
            type="number"
            step="0.01"
            value="${live(mapping.enabledRange[1])}"
            min="${mapping.range[0]}"
            max="${mapping.range[1]}"
            @input="${(event: InputEvent) =>
              this.updateRangeMapping(index, [
                null,
                (event.target as HTMLInputElement).valueAsNumber,
              ])}"
          />
        </label>
      </div>
      <div>
        <label class="is-inline">
          <sgc-checkbox
            .value="${mapping.isUndefinedAlwaysEnabled}"
            @checkboxChange=${() => this.toggleUndefinedAlwaysEnabled(index)}
          >
          </sgc-checkbox>
          ${i18next.t('catalog:voxelFilterWindow.range.shouldIncludeUndefined')}
        </label>
      </div>
    </li>
  `;

  private readonly renderOperators = () => html`
    <li class="operators">
      ${repeat(
        Object.values(FilterOperator),
        (operator) => html`
          <ngm-core-radio
            name="operator"
            .isActive="${live(this.layer.filterOperator === operator)}"
            @click="${() => this.updateOperator(operator)}"
          >
            ${i18next.t(`catalog:voxelFilterWindow.operators.${operator}`)}
          </ngm-core-radio>
        `,
      )}
    </li>
  `;

  static readonly styles = css`
    ${unsafeCSS(fomanticInputCss)}
    ${unsafeCSS(fomanticFormCss)}

    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      width: 520px;
    }

    :host > ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    :host > ul > li {
      padding-block: 10px;

      &:not(:first-child) {
        border-top: 1px solid var(--sgc-color-border--default);
      }

      &:first-child {
        padding-top: 0;
      }
      &:last-child {
        padding-bottom: 0;
      }
    }

    h3 {
      ${applyTypography('modal-title-2')};
      margin: 0 0 5px 0;
    }

    label.field {
      ${applyTypography('body-2-bold')};
    }

    label:has(sgc-checkbox) {
      cursor: pointer;
    }

    label.is-inline {
      display: flex;
      gap: 5px;

      .text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .filter.is-items {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .filter.is-items .controls {
      display: flex;
      gap: 5px;

      & > sgc-button {
        width: 100%;
      }
    }

    .filter.is-items ul {
      display: flex;
      flex-direction: column;
      gap: 5px;

      list-style: none;
      padding: 0;
      margin: 0;

      max-height: 300px;
      overflow-y: auto;
    }

    .filter.is-items .color {
      width: 20px;
      min-width: 20px;
      height: 20px;
      border-radius: 10px;
      background-color: var(--color);
    }

    sgc-checkbox {
      min-width: 20px;
    }

    .operators {
      display: flex;
      justify-content: center;
      gap: 20px;
    }
  `;
}
