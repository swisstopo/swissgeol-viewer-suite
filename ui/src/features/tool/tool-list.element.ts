import { CoreElement } from 'src/features/core';
import { customElement } from 'lit/decorators.js';
import { css, html } from 'lit';
import i18next from 'i18next';

@customElement('ngm-tool-list')
export class ToolList extends CoreElement {
  connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'toolbar');
  }

  readonly render = () => html`
    <ngm-tool-list-item icon="pointShape">${i18next.t('tool.shapes.point', { ns: 'features' })}</ngm-tool-list-item>
    <ngm-tool-list-item icon="lineShape">${i18next.t('tool.shapes.line', { ns: 'features' })}</ngm-tool-list-item>
    <ngm-tool-list-item icon="polygonShape">${i18next.t('tool.shapes.polygon', { ns: 'features' })}</ngm-tool-list-item>
    <ngm-tool-list-item icon="rectangleShape">
      ${i18next.t('tool.shapes.rectangle', { ns: 'features' })}
    </ngm-tool-list-item>
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
  `;
}
