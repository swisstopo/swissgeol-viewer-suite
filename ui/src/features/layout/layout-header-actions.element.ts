import { CoreElement } from 'src/features/core';
import { customElement } from 'lit/decorators.js';
import { css, html } from 'lit';
import { CesiumService } from 'src/services/cesium.service';
import { consume } from '@lit/context';
import { until } from 'lit/directives/until.js';
import { when } from 'lit/directives/when.js';

@customElement('ngm-layout-header-actions')
export class LayoutHeaderActions extends CoreElement {
  @consume({ context: CesiumService.context() })
  accessor cesiumService!: CesiumService;

  // Enable or fully remove this to show the cursor info.
  // It has been disabled for now as excessive picking has been identified as a source of many render errors.
  private readonly isCursorInfoEnabled = true;

  readonly render = () => html`
    ${when(this.isCursorInfoEnabled, () =>
      until(
        this.cesiumService.ready.then(
          () => html`<ngm-layout-cursor-info></ngm-layout-cursor-info>`,
        ),
      ),
    )}
    <div class="separator"></div>
    <div class="suffix">
      <ngm-layout-version-tag></ngm-layout-version-tag>
      <ngm-layout-language-selector></ngm-layout-language-selector>
      <ngm-session></ngm-session>
    </div>
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .suffix {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .separator {
      width: 1px;
      height: 54px;
      background-color: var(--color-border--default);
    }

    ngm-layout-cursor-info[hidden] + .separator {
      display: none;
    }
  `;
}
