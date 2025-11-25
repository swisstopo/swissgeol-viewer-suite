import { css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { OgcService } from 'src/features/ogc/ogc.service';
import { applyTypography } from 'src/styles/theme';
import { LayerService } from 'src/features/layer/layer.service';
import { consume } from '@lit/context';
import { repeat } from 'lit/directives/repeat.js';
import i18next from 'i18next';
import { Cartesian3 } from 'cesium';
import { getLayerLabel, Layer } from 'src/features/layer';
import { Id } from 'src/models/id.model';

@customElement('ngm-ogc-layer-selection')
export class OgcLayerSelection extends CoreElement {
  @property({ type: String })
  accessor title: string = '';

  @property({ type: Object })
  accessor shape: Cartesian3[] = [];

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  @consume({ context: OgcService.context() })
  accessor ogcService!: OgcService;

  @state()
  accessor layers: readonly Layer[] = [];

  private readonly selectedLayerIds = new Set<Id<Layer>>();

  private readonly disabledLayers = new Set<Id<Layer>>();

  private isSubmitting = false;

  connectedCallback() {
    super.connectedCallback();

    this.register(
      this.layerService.activeLayers$.subscribe(async (layers) => {
        this.layers = layers;

        this.disabledLayers.clear();
        await Promise.all(
          layers.map(async (layer) => {
            const isSupported = await this.ogcService.isLayerSupported(layer);
            if (isSupported) {
              this.disabledLayers.delete(layer.id);
            } else {
              this.disabledLayers.add(layer.id);
            }
          }),
        );
        this.requestUpdate();
      }),
    );
  }

  private readonly toggle = (id: Id<Layer>): void => {
    if (this.selectedLayerIds.has(id)) {
      this.selectedLayerIds.delete(id);
    } else {
      this.selectedLayerIds.add(id);
    }
    this.requestUpdate();
  };

  private readonly confirm = async () => {
    if (this.isSubmitting) {
      return;
    }
    this.isSubmitting = true;
    this.close();
    const job = await this.ogcService.start(
      this.title,
      [...this.selectedLayerIds.values()].map((id) =>
        this.layerService.layer(id),
      ),
      this.shape,
    );
    if (job === null) {
      console.warn(
        'Export was not started as none of the selected layers is supported by OGC.',
      );
    }
  };

  private readonly close = () => {
    this.dispatchEvent(new CustomEvent('close'));
  };

  readonly render = () => html`
    <div class="header">
      <h2>${i18next.t('toolbox:ogc.layer-selection.title')}</h2>
    </div>
    <ul class="content">
      ${repeat(this.layers, (it) => it.id, this.renderLayer)}
    </ul>
    <div class="actions">
      <sgc-button color="secondary" @click="${this.close}">
        ${i18next.t('cancel')}
      </sgc-button>
      <sgc-button
        @click="${this.confirm}"
        .isDisabled="${this.selectedLayerIds.size === 0}"
      >
        ${i18next.t('toolbox:ogc.layer-selection.confirm')}
      </sgc-button>
    </div>
  `;

  private readonly renderLayer = (layer: Layer) => {
    const isActive = this.selectedLayerIds.has(layer.id);
    const isDisabled = this.disabledLayers.has(layer.id);
    return html`
      <li>
        <sgc-button
          color="secondary"
          justify="start"
          ?disabled="${isDisabled}"
          .isActive="${isActive}"
          @click="${() => this.toggle(layer.id)}"
        >
          <ngm-core-checkbox
            ?disabled="${isDisabled}"
            .isActive="${isActive}"
            @update="${() => this.toggle(layer.id)}"
          ></ngm-core-checkbox>
          ${getLayerLabel(layer)}
        </sgc-button>
      </li>
    `;
  };

  static readonly styles = css`
    h2 {
      ${applyTypography('modal-title-1')}
      margin: 0;
    }

    .header {
      padding: 24px 24px 16px 24px;
      border-bottom: 1px solid var(--sgc-color-border--default);
    }

    ul.content {
      display: flex;
      flex-direction: column;
      gap: 6px;

      list-style: none;
      padding: 16px 24px;
      margin: 0;
      border-bottom: 1px solid var(--sgc-color-border--default);
    }

    ul.content > li {
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
      padding: 24px;
    }
  `;
}
