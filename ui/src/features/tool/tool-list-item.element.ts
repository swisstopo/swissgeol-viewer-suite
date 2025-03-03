import { CoreElement } from 'src/features/core';
import { customElement, property, state } from 'lit/decorators.js';
import { css, html } from 'lit';
import { DrawToolVariant, ToolType } from 'src/features/tool/tool.model';
import i18next from 'i18next';
import { consume } from '@lit/context';
import { ToolService } from 'src/features/tool/tool.service';

@customElement('ngm-tool-list-item')
export class ToolListItem extends CoreElement {
  @property({ type: String, reflect: true })
  accessor variant: DrawToolVariant | null = null;

  @consume({ context: ToolService.context() })
  accessor toolService!: ToolService;

  @state()
  accessor isActive = false;

  public connectedCallback(): void {
    super.connectedCallback();

    this.register(
      this.toolService.selectToolByType$(ToolType.Draw).subscribe((tool) => {
        this.isActive = tool?.variant === this.variant;
      }),
    );
  }

  private handleClick(): void {
    if (this.isActive) {
      this.toolService.deactivate();
    } else {
      this.toolService.activate({
        type: ToolType.Draw,
        variant: this.variant!,
      });
    }
  }

  readonly render = () => html`
    <ngm-core-button
      variant="tertiary"
      shape="large"
      justify="start"
      @click="${this.handleClick}"
      ?active="${this.isActive}"
    >
      <ngm-core-icon icon="${this.variant}Shape"></ngm-core-icon>
      ${i18next.t(`tool.shapes.${this.variant}`, { ns: 'features' })}
    </ngm-core-button>
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }
  `;
}
