import { CoreElement } from 'src/features/core';
import { customElement, property } from 'lit/decorators.js';
import { css, html } from 'lit';
import { ToolShape, ToolType } from 'src/features/tool/tool.model';
import i18next from 'i18next';
import { consume } from '@lit/context';
import { ToolService } from 'src/features/tool/tool.service';

@customElement('ngm-tool-list-item')
export class ToolListItem extends CoreElement {
  @property({ type: String, reflect: true })
  accessor shape: ToolShape | null = null;

  @consume({ context: ToolService.context() })
  accessor toolService!: ToolService;

  private handleClick(): void {
    this.toolService.activate({
      type: ToolType.Draw,
      shape: this.shape!,
    });
  }

  readonly render = () => html`
    <ngm-core-button variant="tertiary" shape="large" justify="start" @click="${this.handleClick}">
      <ngm-core-icon icon="${this.shape}Shape"></ngm-core-icon>
      ${i18next.t(`tool.shapes.${this.shape}`, { ns: 'features' })}
    </ngm-core-button>
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }
  `;
}
