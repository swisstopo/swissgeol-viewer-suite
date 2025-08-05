import { customElement, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { consume } from '@lit/context';
import { repeat } from 'lit/directives/repeat.js';
import { css, html } from 'lit';
import { LayerInfo } from 'src/features/layer/info/layer-info.model';
import { LayerInfoService } from 'src/features/layer/info/layer-info.service';

@customElement('ngm-layer-info-list')
export class LayerInfoList extends CoreElement {
  @consume({ context: LayerInfoService.context() })
  accessor layerInfoService!: LayerInfoService;

  @state()
  accessor infos: readonly LayerInfo[] = [];

  connectedCallback() {
    super.connectedCallback();
    this.register(
      this.layerInfoService.infos$.subscribe((infos) => {
        this.infos = infos;
      }),
    );
  }

  readonly render = () =>
    repeat(
      this.infos,
      (info) => info,
      (info, i) =>
        html`<ngm-layer-info-item
          .info="${info}"
          .isFirst="${i === 0}"
        ></ngm-layer-info-item>`,
    );

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      width: 388px;

      display: flex;
      flex-direction: column;
      gap: 36px;
    }
  `;
}
