import { customElement, state } from 'lit/decorators.js';
import { CoreElement, renderTabs, TabValueChangeEvent } from 'src/features/core';
import { css, html } from 'lit';
import i18next from 'i18next';
import { consume } from '@lit/context';
import { ToolService } from 'src/features/tool/tool.service';
import { Feature, ToolType } from 'src/features/tool/tool.model';
import { of, switchMap, tap } from 'rxjs';
import { MapService } from 'src/features/map/map.service';

@customElement('ngm-tool-panel')
export class ToolPanel extends CoreElement {
  @state()
  private accessor activeTab = Tab.Draw;

  @state()
  private accessor hasFeatures = false;

  @state()
  private accessor selectedFeature: Feature | null = null;

  @consume({ context: ToolService.context() })
  private accessor toolService!: ToolService;

  @consume({ context: MapService.elementContext, subscribe: true })
  private accessor mapElement!: HTMLElement;

  connectedCallback(): void {
    super.connectedCallback();

    this.register(
      this.toolService.features$.subscribe((features) => {
        this.hasFeatures = features.length === 0;
      }),
    );
    this.register(
      this.toolService.activeTool$.pipe(
        switchMap((tool) => {
          switch (tool?.type) {
            case ToolType.Edit:
            case ToolType.Info:
              return this.toolService.findFeature$(tool.featureId);
            default:
              return of(null);
          }
        }),
        tap((it) => (this.selectedFeature = it)),
      ),
    );

    this.register(() => this.toolService.deactivate());
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent('close'));
  }

  private handleTabChange(event: TabValueChangeEvent<Tab>): void {
    this.activeTab = event.detail.value;
  }

  private handleSelectionClosed(): void {
    this.toolService.deactivate();
  }

  private readonly translateTabName = (tab: Tab) => i18next.t(`tool.tabs.${tab}`, { ns: 'features' });

  readonly render = () => html`
    <ngm-navigation-panel>
      <ngm-navigation-panel-header slot="heading" closeable @close="${this.close}">
        ${i18next.t('tool.heading', { ns: 'features' })}
      </ngm-navigation-panel-header>

      ${this.toolService.isEmpty
        ? undefined
        : html`
            <ngm-tool-feature-list></ngm-tool-feature-list>
            <ngm-navigation-panel-divider></ngm-navigation-panel-divider>
          `}
      ${renderTabs(Tab, {
        value: this.activeTab,
        onValueChange: this.handleTabChange,
        tab: this.translateTabName,
        panels: {
          [Tab.Draw]: html`
            <ngm-tool-list></ngm-tool-list>
          `,
          [Tab.Measure]: html``,
          [Tab.Upload]: html``,
        },
      })}
      ${this.selectedFeature === null
        ? undefined
        : html`
            <ngm-core-portal .target="${this.mapElement}">
              <ngm-tool-feature-info
                .feature="${this.selectedFeature}"
                @close="${this.handleSelectionClosed}"
              ></ngm-tool-feature-info>
            </ngm-core-portal>
          `}
    </ngm-navigation-panel>
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }
  `;
}

enum Tab {
  Draw = 'draw',
  Measure = 'measure',
  Upload = 'upload',
}
