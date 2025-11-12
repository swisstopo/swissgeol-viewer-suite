import { customElement, state } from 'lit/decorators.js';
import { Viewer } from 'cesium';
import { css, html } from 'lit';
import i18next from 'i18next';
import { debounce } from 'src/utils';
import { setExaggeration } from 'src/permalink';
import NavToolsStore from 'src/store/navTools';
import '../core';
import { SliderChangeEvent } from 'src/features/core/core-slider.element';
import { viewerContext } from 'src/context';
import { consume } from '@lit/context';
import { CoreElement, tooltip } from 'src/features/core';
import { LayerService } from 'src/features/layer';

@customElement('ngm-catalog-settings')
export class LayerOptions extends CoreElement {
  @consume({ context: viewerContext })
  accessor viewer!: Viewer;

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  @state()
  private accessor exaggeration: number = 1;

  @state()
  private accessor isExaggerationHidden = false;

  connectedCallback() {
    super.connectedCallback();

    this.exaggeration = this.viewer?.scene.verticalExaggeration ?? 1;
  }

  private toggleExaggerationVisibility() {
    this.isExaggerationHidden = !this.isExaggerationHidden;
    const exaggeration = this.isExaggerationHidden ? 1 : this.exaggeration;
    this.viewer.scene.verticalExaggeration = exaggeration;
    this.layerService.controllers.forEach((controller) =>
      controller.updateExaggeration(exaggeration),
    );
    NavToolsStore.exaggerationChanged.next(exaggeration);
    this.viewer.scene.requestRender();
  }

  private updateExaggeration(event: SliderChangeEvent) {
    if (this.viewer == null) {
      return;
    }
    this.isExaggerationHidden = false;
    this.exaggeration = event.detail.value;
    this.viewer.scene.verticalExaggeration = this.exaggeration;

    // workaround for billboards positioning
    setTimeout(() => this.viewer!.scene.requestRender(), 500);
    setExaggeration(this.exaggeration);
    NavToolsStore.exaggerationChanged.next(this.exaggeration);
  }

  private propagateExaggerationChange() {
    this.layerService.controllers.forEach((controller) =>
      controller.updateExaggeration(this.viewer.scene.verticalExaggeration),
    );
  }

  readonly render = () => html`
    <div class="group">
      <ngm-core-button
        transparent
        variant="tertiary"
        shape="icon"
        data-cy="visibility"
        @click="${this.toggleExaggerationVisibility}"
      >
        <ngm-core-icon
          icon="${this.isExaggerationHidden ? 'hidden' : 'visible'}"
        ></ngm-core-icon>
      </ngm-core-button>
      ${tooltip(
        this.isExaggerationHidden
          ? i18next.t('catalog:exaggeration.show')
          : i18next.t('catalog:exaggeration.hide'),
      )}
      <label>${i18next.t('catalog:exaggeration.title')}</label>
    </div>
    <hr />
    <div class="group">
      <ngm-core-slider
        data-cy="exaggeration-slider"
        .min="${1}"
        .max="${10}"
        .step="${0.5}"
        .value="${this.exaggeration}"
        @change=${this.updateExaggeration}
        @done="${debounce(() => this.propagateExaggerationChange(), 300)}"
      ></ngm-core-slider>
      <div class="chip-container">
        <ngm-core-chip data-cy="exaggeration-factor"
          >${this.exaggeration}x</ngm-core-chip
        >
      </div>
    </div>
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      flex-direction: column;
      justify-content: center;
      background-color: var(--color-bg--white);
      box-sizing: border-box;
      border: 1px solid var(--color-border--default);
      border-radius: 4px;
    }

    hr {
      margin: 0 10px;
      height: 1px;
      border-width: 0;
      color: var(--color-border--default);
      background-color: var(--color-border--default);
    }

    .group {
      display: flex;
      justify-content: flex-start;
      gap: 6px;
      align-items: center;
      margin: 10px;
    }

    .chip-container {
      min-width: 48px;
      display: flex;
      justify-content: flex-end;
    }

    .chip-container > ngm-core-chip {
      min-width: 40px;
    }
  `;
}
