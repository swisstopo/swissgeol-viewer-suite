import { CoreElement, TabValueChangeEvent } from 'src/features/core';
import { consume } from '@lit/context';
import { ToolService } from 'src/features/tool/tool.service';
import { Drawing, DrawToolVariant } from 'src/features/tool/tool.model';
import { customElement, state } from 'lit/decorators.js';
import { css, html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { identity } from 'rxjs';
import i18next from 'i18next';

@customElement('ngm-tool-shape-list')
export class ToolShapeList extends CoreElement {
  @consume({ context: ToolService.context() })
  accessor toolService!: ToolService;

  @state()
  private accessor drawings: Drawing[] = [];

  @state()
  private accessor filter: DrawToolVariant | null = null;

  connectedCallback(): void {
    super.connectedCallback();

    this.register(
      this.toolService.drawings$.subscribe((drawings) => {
        this.drawings = drawings;
      }),
    );
  }

  private handleFilterChange(event: TabValueChangeEvent<Filter>): void {
    this.filter = event.detail.value;
  }

  readonly render = () => html`
    <div role="toolbar" class="filters">
      <ngm-core-tab-list .value="${this.filter}" @value-change="${this.handleFilterChange}">
        <ngm-core-tab .value="${null}">Alle</ngm-core-tab>
        <ngm-core-tooltip>Alle</ngm-core-tooltip>

        ${repeat(
          Object.values(DrawToolVariant),
          (it) => `${it}-${this.language}`,
          (variant) => html`
            <ngm-core-tab .value="${variant}">
              <ngm-core-icon icon="${variant}Shape" size="small"></ngm-core-icon>
            </ngm-core-tab>
            <ngm-core-tooltip>${i18next.t(`tool.shapes.${variant}`, { ns: 'features' })}</ngm-core-tooltip>
          `,
        )}
        <ngm-core-tab standalone>
          <ngm-core-icon icon="menu" size="small"></ngm-core-icon>
        </ngm-core-tab>
        <ngm-core-dropdown>
          <ngm-core-dropdown-item role="button">Hey!</ngm-core-dropdown-item>
        </ngm-core-dropdown>
      </ngm-core-tab-list>
    </div>
  `;

  static readonly styles = css``;
}

type Filter = DrawToolVariant;
