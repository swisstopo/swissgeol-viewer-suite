import { css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { WmtsLayer } from 'src/features/layer';
import { repeat } from 'lit/directives/repeat.js';
import { run } from 'src/utils/fn.utils';
import i18next from 'i18next';
import { consume } from '@lit/context';
import { LayerService } from 'src/features/layer/new/layer.service';
import { Id } from 'src/models/id.model';

@customElement('ngm-catalog-display-times')
export class CatalogDisplayTimes extends CoreElement {
  @property()
  accessor layerId!: Id<WmtsLayer>;

  @state()
  accessor layer!: WmtsLayer;

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  connectedCallback(): void {
    super.connectedCallback();

    this.register(
      this.layerService.layer$(this.layerId).subscribe((layer) => {
        this.layer = layer;
      }),
    );
  }

  private readonly selectTime = (time: string) => {
    this.layerService.update(this.layer.id, {
      times: { ...this.layer.times!, current: time },
    });
  };

  readonly render = () => html`
    <ul>
      ${repeat(this.layer.times?.all ?? [], this.renderItem)}
    </ul>
  `;

  private readonly renderItem = (time: string) => {
    const title = run(() => {
      if (time === '9999') {
        return i18next.t('catalog:timesWindow.all');
      }
      if (time.length > 4) {
        return time.substring(0, 4);
      }
      return time;
    });
    return html`
      <li>
        <sgc-button
          color="secondary"
          size="small"
          ?active="${this.layer.times?.current === time}"
          @click="${() => this.selectTime(time)}"
          >${title}</sgc-button
        >
      </li>
    `;
  };

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host > ul {
      list-style: none;

      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-auto-rows: auto;
      gap: 10px;
      max-height: 300px;
      margin: 0;
      padding: 0;
    }
  `;
}
