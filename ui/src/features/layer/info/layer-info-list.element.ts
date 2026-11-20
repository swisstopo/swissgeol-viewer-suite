import { customElement, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { consume } from '@lit/context';
import { repeat } from 'lit/directives/repeat.js';
import { keyed } from 'lit/directives/keyed.js';
import { css, html, nothing } from 'lit';
import i18next from 'i18next';
import { applyTypography } from 'src/styles/theme';
import { LayerInfo } from 'src/features/layer/info/layer-info.model';
import { splitLayerInfos } from 'src/features/layer/info/layer-info-results';
import { LayerInfoService } from 'src/features/layer/info/layer-info.service';

const TAB_ORDER = ['exact', 'samePosition', 'nearby'] as const;
type ResultTab = (typeof TAB_ORDER)[number];
type TabResults = Record<ResultTab, readonly LayerInfo[]>;

const toTabResults = (infos: readonly LayerInfo[]): TabResults => {
  const { exact, samePosition, nearby } = splitLayerInfos(infos);
  return { exact: exact === null ? [] : [exact], samePosition, nearby };
};

const tabLabels = (): Record<ResultTab, string> => ({
  exact: i18next.t('layers:info_window.exact_tab'),
  samePosition: i18next.t('layers:info_window.same_position_tab'),
  nearby: i18next.t('layers:info_window.nearby_tab'),
});

@customElement('ngm-layer-info-list')
export class LayerInfoList extends CoreElement {
  @consume({ context: LayerInfoService.context() })
  accessor layerInfoService!: LayerInfoService;

  @state()
  private accessor results: TabResults = toTabResults([]);

  @state()
  private accessor activeTab: ResultTab | null = null;

  @state()
  private accessor expanded: LayerInfo | null = null;

  private infos: readonly LayerInfo[] = [];
  private hovered: LayerInfo | null = null;
  private focused: LayerInfo | null = null;
  private preview: LayerInfo | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.register(this.layerInfoService.infos$.subscribe(this.updateResults));
  }

  disconnectedCallback(): void {
    this.clearPreview();
    super.disconnectedCallback();
  }

  private readonly updateResults = (infos: readonly LayerInfo[]): void => {
    const previous =
      this.activeTab === null ? [] : this.results[this.activeTab];
    const previousSelection =
      previous.length === 1 ? previous[0] : this.expanded;
    const isNewPick = !this.infos.some((info) => infos.includes(info));
    this.infos = infos;
    this.results = toTabResults(infos);
    const previousTab = this.activeTab;
    if (
      isNewPick ||
      previousTab === null ||
      this.results[previousTab].length === 0
    ) {
      this.activeTab =
        TAB_ORDER.find((tab) => this.results[tab].length > 0) ?? null;
      this.expanded = null;
      this.clearPreview();
    }
    const visible = this.activeTab === null ? [] : this.results[this.activeTab];
    if (this.expanded !== null && !visible.includes(this.expanded)) {
      this.expanded = null;
    }
    if (this.hovered !== null && !visible.includes(this.hovered)) {
      this.hovered = null;
    }
    if (this.focused !== null && !visible.includes(this.focused)) {
      this.focused = null;
    }
    this.updatePreview();

    const selection = visible.length === 1 ? visible[0] : this.expanded;
    if (isNewPick || selection !== previousSelection) {
      this.layerInfoService.selectInfo(selection);
    }
  };

  private readonly activateTab = (tab: ResultTab): void => {
    const results = this.results[tab];
    if (tab === this.activeTab || results.length === 0) {
      return;
    }
    this.clearPreview();
    this.activeTab = tab;
    this.expanded = null;
    this.layerInfoService.selectInfo(results.length === 1 ? results[0] : null);
  };

  private readonly handleTabKey = (event: KeyboardEvent): void => {
    if (this.activeTab === null) {
      return;
    }
    const enabledTabs = TAB_ORDER.filter((tab) => this.results[tab].length > 0);
    const currentIndex = enabledTabs.indexOf(this.activeTab);
    let nextIndex;
    switch (event.key) {
      case 'ArrowLeft':
        nextIndex =
          (currentIndex - 1 + enabledTabs.length) % enabledTabs.length;
        break;
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % enabledTabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = enabledTabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const tab = enabledTabs[nextIndex];
    this.activateTab(tab);
    this.renderRoot
      .querySelector<HTMLButtonElement>(`#info-tab-${tab}`)
      ?.focus();
  };

  private toggleFeature(info: LayerInfo): void {
    this.expanded = this.expanded === info ? null : info;
    this.layerInfoService.selectInfo(this.expanded);
  }

  private updatePreview(): void {
    const info = this.hovered ?? this.focused;
    if (info === this.preview) {
      return;
    }
    if (info !== null) {
      this.layerInfoService.previewInfo(info);
    } else if (this.preview !== null) {
      this.layerInfoService.clearPreview(this.preview);
    }
    this.preview = info;
  }

  private clearPreview(): void {
    this.hovered = null;
    this.focused = null;
    this.updatePreview();
  }

  private setHovered(info: LayerInfo): void {
    this.hovered = info;
    this.updatePreview();
  }

  private clearHovered(info: LayerInfo): void {
    if (this.hovered === info) {
      this.hovered = null;
      this.updatePreview();
    }
  }

  private setFocused(info: LayerInfo): void {
    // Pointer activation focuses its own row. Only keyboard navigation needs
    // a focus preview that lasts after the pointer has left.
    if (this.hovered !== info) {
      this.focused = info;
      this.updatePreview();
    }
  }

  private clearFocused(info: LayerInfo, event: FocusEvent): void {
    const row = event.currentTarget as HTMLElement;
    if (
      this.focused === info &&
      !row.contains(event.relatedTarget as Node | null)
    ) {
      this.focused = null;
      this.updatePreview();
    }
  }

  private getFeatureLabel(
    info: LayerInfo,
    results: readonly LayerInfo[],
  ): string | null {
    const matches = results.filter(
      (other) =>
        other.layerId === info.layerId &&
        other.featureLabel === info.featureLabel,
    );
    if (!info.featureLabel) {
      return matches.length > 1
        ? i18next.t('layers:info_window.feature', {
            index: matches.indexOf(info) + 1,
          })
        : null;
    }
    return matches.length > 1
      ? i18next.t('layers:info_window.feature_numbered', {
          label: info.featureLabel,
          index: matches.indexOf(info) + 1,
        })
      : info.featureLabel;
  }

  readonly render = () => {
    if (this.activeTab === null) {
      return nothing;
    }
    const labels = tabLabels();
    return html`
      <div
        class="tabs"
        role="tablist"
        aria-label=${i18next.t('layers:info_window.result_tabs')}
        @keydown=${this.handleTabKey}
      >
        ${TAB_ORDER.map((tab) => {
          const isActive = tab === this.activeTab;
          const count = this.results[tab].length;
          return html`<button
            type="button"
            role="tab"
            data-tab=${tab}
            id="info-tab-${tab}"
            aria-controls="info-panel-${tab}"
            aria-selected=${isActive}
            tabindex=${isActive ? 0 : -1}
            ?disabled=${count === 0}
            @click=${() => this.activateTab(tab)}
          >
            <span>${labels[tab]}</span>
            ${
              tab !== 'exact' && count > 0
                ? html`<span class="badge">${count}</span>`
                : nothing
            }
          </button>`;
        })}
      </div>
      ${TAB_ORDER.map((tab) => {
        const isActive = tab === this.activeTab;
        return html`<div
          class="tab-panel"
          role="tabpanel"
          id="info-panel-${tab}"
          aria-labelledby="info-tab-${tab}"
          ?hidden=${!isActive}
        >
          ${isActive ? this.renderResults(this.results[tab]) : nothing}
        </div>`;
      })}
    `;
  };

  private renderFeatureName(info: LayerInfo, results: readonly LayerInfo[]) {
    const layer = i18next.t(info.title);
    const label = this.getFeatureLabel(info, results);
    const distance =
      info.match === 'nearby' && info.distance != null
        ? i18next.t('layers:info_window.distance', {
            distance: new Intl.NumberFormat(i18next.language, {
              maximumFractionDigits: 1,
            }).format(info.distance),
          })
        : null;
    return html`
      <span class="feature-name">
        <span class="layer-name">${layer}</span>
        ${
          label !== null && label !== layer
            ? html`<span class="feature-label">${label}</span>`
            : nothing
        }
      </span>
      ${
        distance === null
          ? nothing
          : html`<span class="distance">${distance}</span>`
      }
    `;
  }

  private renderResults(results: readonly LayerInfo[]) {
    if (results.length === 1) {
      const info = results[0];
      return keyed(
        info,
        html`<article
          class="feature single"
          tabindex="0"
          @mouseenter=${() => this.setHovered(info)}
          @mouseleave=${() => this.clearHovered(info)}
          @focusin=${() => this.setFocused(info)}
          @focusout=${(event: FocusEvent) => this.clearFocused(info, event)}
        >
          <div class="feature-heading">
            ${this.renderFeatureName(info, results)}
          </div>
          <ngm-layer-info-item
            .info=${info}
            .featureAttributes=${info.attributes}
          ></ngm-layer-info-item>
        </article>`,
      );
    }
    return html`<ul class="features">
      ${repeat(
        results,
        (info) => info,
        (info, index) => {
          const isExpanded = info === this.expanded;
          const detailId = `info-feature-${index}`;
          return html`<li
            class="feature"
            @mouseenter=${() => this.setHovered(info)}
            @mouseleave=${() => this.clearHovered(info)}
            @focusin=${() => this.setFocused(info)}
            @focusout=${(event: FocusEvent) => this.clearFocused(info, event)}
          >
            <button
              type="button"
              class="feature-toggle"
              aria-expanded=${isExpanded}
              aria-controls=${detailId}
              @click=${() => this.toggleFeature(info)}
            >
              ${this.renderFeatureName(info, results)}
              <sgc-icon name="chevronDown" aria-hidden="true"></sgc-icon>
            </button>
            <div class="feature-detail" id=${detailId} ?hidden=${!isExpanded}>
              ${
                isExpanded
                  ? html`<ngm-layer-info-item
                      .info=${info}
                      .featureAttributes=${info.attributes}
                    ></ngm-layer-info-item>`
                  : nothing
              }
            </div>
          </li>`;
        },
      )}
    </ul>`;
  }

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      width: 388px;
      max-width: calc(100vw - 64px);
      display: block;
    }

    .tabs {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      border-bottom: 1px solid var(--sgc-color-border--default);
    }

    [role='tab'] {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 4px 6px;
      min-height: 42px;
      padding: 6px 4px;
      border: 0;
      border-bottom: 2px solid transparent;
      color: var(--sgc-color-primary);
      background: transparent;
      cursor: pointer;
      overflow-wrap: anywhere;
      ${applyTypography('body-2')}
    }

    [role='tab'][aria-selected='true'] {
      border-bottom-color: var(--sgc-color-primary);
      ${applyTypography('body-2-bold')}
    }

    [role='tab']:disabled {
      opacity: 0.5;
      cursor: default;
    }

    .badge {
      flex: none;
      min-width: 20px;
      padding: 0 5px;
      border-radius: 10px;
      background-color: var(--sgc-color-bg--grey);
      font-variant-numeric: tabular-nums;
      ${applyTypography('body-2-bold')}
    }

    .tab-panel:not([hidden]) {
      margin-top: 10px;
    }

    .features {
      list-style: none;
      display: grid;
      gap: 4px;
      margin: 0;
      padding: 0;
    }

    li.feature {
      min-width: 0;
      border: 1px solid var(--sgc-color-border--default);
      border-radius: 4px;
    }

    .feature-toggle,
    .feature-heading {
      width: 100%;
      min-height: 40px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 8px;
      border: 0;
      border-radius: 4px;
      color: var(--sgc-color-primary);
      background: transparent;
      text-align: start;
      overflow-wrap: anywhere;
    }

    .feature-toggle {
      cursor: pointer;
    }

    .feature-toggle:hover,
    .feature-toggle[aria-expanded='true'],
    .feature-heading:hover {
      background-color: var(--sgc-color-bg--grey);
    }

    [role='tab']:focus-visible,
    .feature-toggle:focus-visible,
    .single:focus-visible {
      outline: 2px solid var(--sgc-color-primary);
      outline-offset: -2px;
    }

    .feature-name {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .layer-name {
      ${applyTypography('body-2-bold')}
    }

    .feature-label,
    .distance {
      ${applyTypography('body-2')}
    }

    .distance,
    sgc-icon {
      flex: none;
      white-space: nowrap;
    }

    [aria-expanded='true'] sgc-icon {
      transform: rotate(180deg);
    }

    .feature-detail,
    .single > ngm-layer-info-item {
      margin-block: 6px;
    }
  `;
}
