import { CoreElement } from 'src/features/core';
import { customElement } from 'lit/decorators.js';
import { COGNITO_VARIABLES } from 'src/constants';
import { css, html } from 'lit';

@customElement('ngm-layout-header-actions')
export class LayoutHeaderActions extends CoreElement {
  readonly render = () => html`
    <ngm-layout-cursor-info></ngm-layout-cursor-info>
    <div class="separator"></div>
    <div class="suffix">
      <ngm-layout-version-tag></ngm-layout-version-tag>
      <ngm-layout-language-selector></ngm-layout-language-selector>
      <ngm-auth
        class="ngm-user"
        endpoint="https://ngm-${COGNITO_VARIABLES.env}.auth.eu-west-1.amazoncognito.com/oauth2/authorize"
        clientId=${COGNITO_VARIABLES.clientId}
      ></ngm-auth>
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
