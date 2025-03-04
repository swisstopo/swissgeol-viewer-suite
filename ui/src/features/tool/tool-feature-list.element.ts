import { CoreElement, TabValueChangeEvent } from 'src/features/core';
import { consume } from '@lit/context';
import { ToolService } from 'src/features/tool/tool.service';
import { Feature, Shape } from 'src/features/tool/tool.model';
import { customElement, state } from 'lit/decorators.js';
import { css, html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import i18next from 'i18next';

@customElement('ngm-tool-feature-list')
export class ToolFeatureList extends CoreElement {
  @consume({ context: ToolService.context() })
  accessor toolService!: ToolService;

  @state()
  private accessor features: Feature[] = [];

  @state()
  private accessor filter: Shape | null = null;

  connectedCallback(): void {
    super.connectedCallback();

    this.register(
      this.toolService.features$.subscribe((features) => {
        this.features = features;
      }),
    );
  }

  private handleFilterChange(event: TabValueChangeEvent<Shape | null>): void {
    this.filter = event.detail.value;
  }

  readonly render = () => html`
    <div role="toolbar" class="filters">
      <ngm-core-tab-list .value="${this.filter}" @value-change="${this.handleFilterChange}">
        <ngm-core-tab .value="${null}">Alle</ngm-core-tab>
        <ngm-core-tooltip>Alle</ngm-core-tooltip>
        ${repeat(
          Object.values(Shape),
          (it) => `${it}-${this.language}`,
          (shape) => html`
            <ngm-core-tab .value="${shape}">
              <ngm-core-icon icon="${shape}Shape" size="small"></ngm-core-icon>
            </ngm-core-tab>
            <ngm-core-tooltip>${i18next.t(`tool.shapes.${shape}`, { ns: 'features' })}</ngm-core-tooltip>
          `,
        )}

        <ngm-core-button transparent variant="tertiary" shape="icon" class="actions">
          <ngm-core-icon icon="menu"></ngm-core-icon>
        </ngm-core-button>
        <ngm-core-dropdown>
          <ngm-core-dropdown-item role="button">Hey!</ngm-core-dropdown-item>
        </ngm-core-dropdown>
      </ngm-core-tab-list>
      <hr />
    </div>
    <ul class="geometries">
      ${repeat(
        this.features,
        (it) => it.id,
        (feature) => html`
          <li>
            <ngm-tool-feature-list-item .feature="${feature}"></ngm-tool-feature-list-item>
          </li>
        `,
      )}
    </ul>
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;

      background-color: var(--color-bg--white);
      border-radius: 4px;
      padding: 12px;
    }

    .filters {
      padding-inline: 4px;
    }

    hr {
      display: block;
      height: 1px;
      margin: 0 6px;
      border: 0;
      background-color: var(--color-border--default);
    }

    ul.geometries {
      display: flex;
      flex-direction: column;
      gap: 12px;

      padding: 0;
      margin: 0;
      list-style-type: none;
    }
  `;
}
