import { CoreElement } from 'src/features/core';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { clientConfigContext } from 'src/context';
import { ClientConfig } from 'src/api/client-config';
import { css } from 'lit';
import { applyTypography } from 'src/styles/theme';

@customElement('layout-env-ribbon')
export class LayoutEnvRibbon extends CoreElement {
  @consume({ context: clientConfigContext })
  accessor clientConfig!: ClientConfig;

  private get text(): string {
    const { env } = this.clientConfig;
    return env === 'prod' ? 'beta' : env;
  }

  readonly render = () => this.text;

  static readonly styles = css`
    :host {
      ${applyTypography('overline')}

      display: flex;
      justify-content: center;
      align-items: center;

      position: fixed;
      background: var(--color-primary);
      color: var(--color-text--invert);
      padding: 4px 12px;
      pointer-events: none;

      width: 80px;
      height: 25px;
      top: 7px;
      left: -20px;
      font-size: 13px;
      text-transform: uppercase;
      transform: rotate(-45deg);
      z-index: 20;
    }
  `;
}
