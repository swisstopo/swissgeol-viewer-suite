import { CoreElement } from 'src/features/core';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { clientConfigContext } from 'src/context';
import { ClientConfig } from 'src/api/client-config';
import { css } from 'lit';
import { applyTypography } from 'src/styles/theme';

@customElement('ngm-layout-version-tag')
export class LayoutVersionTag extends CoreElement {
  @consume({ context: clientConfigContext })
  accessor clientConfig!: ClientConfig;

  readonly render = () => this.clientConfig.version;

  static readonly styles = css`
    :host {
      ${applyTypography('overline')}
      color: var(--color-text--disabled);
    }
  `;
}
