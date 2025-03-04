import { CoreElement } from 'src/features/core';
import { customElement, property, state } from 'lit/decorators.js';
import { css, html } from 'lit';
import { Feature } from 'src/features/tool/tool.model';
import i18next from 'i18next';
import { consume } from '@lit/context';
import { ToolService } from 'src/features/tool/tool.service';

@customElement('ngm-tool-feature-list-item')
export class ToolFeatureListItem extends CoreElement {
  @property({ type: Object })
  accessor feature: Feature | null = null;

  @state()
  private accessor isVisible = true;

  @consume({ context: ToolService.context() })
  accessor toolService!: ToolService;

  private makeNameOfFeature(feature: Feature): string {
    const { name, geometry } = feature;
    if (typeof name === 'string') {
      return name;
    }
    if ('number' in name) {
      const shapeName = i18next.t(`tool.shapes.${geometry.shape}`, { ns: 'features' });
      return `${shapeName} ${name.number}`;
    }
    const base = this.toolService.findFeature(name.baseId)!;
    return i18next.t('tool.name_for_copied_geometry', { ns: 'feature', base: this.makeNameOfFeature(base) });
  }

  readonly render = () => {
    const { feature } = this;
    if (feature === null) {
      return;
    }
    return html`
      <ngm-core-button transparent variant="tertiary" shape="icon">
        <ngm-core-icon icon="${this.isVisible ? 'visible' : 'hidden'}"></ngm-core-icon>
      </ngm-core-button>
      <ngm-core-icon icon="${feature.geometry.shape}Shape" size="small" class="shape"></ngm-core-icon>
      <span class="name">${this.makeNameOfFeature(feature)}</span>
      <ngm-core-button transparent variant="tertiary" shape="icon" class="actions">
        <ngm-core-icon icon="menu"></ngm-core-icon>
      </ngm-core-button>
      <ngm-core-dropdown>
        <ngm-core-dropdown-item role="button">Hey!</ngm-core-dropdown-item>
      </ngm-core-dropdown>
    `;
  };

  static readonly styles = css`
    :host {
      display: flex;
      gap: 6px;
      align-items: center;
      padding: 10px;
      border-radius: 4px;
    }

    ngm-core-icon.shape {
      color: var(--color-text--disabled);
    }

    .name {
      flex: 1;
    }
  `;
}
