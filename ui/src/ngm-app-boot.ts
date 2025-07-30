import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import './ngm-app';
import { Task } from '@lit/task';

import { ClientConfig } from './api/client-config';
import { registerAppContext } from './context';
import { ConfigService } from './api/config.service';

@customElement('ngm-app-boot')
export class NgmAppBoot extends LitElement {
  private readonly viewerInitialization = new Task(this, {
    task: async () => {
      const clientConfig =
        (await new ConfigService().getConfig()) as ClientConfig;
      if (!clientConfig) {
        throw new Error('Failed to load client config');
      }
      return clientConfig;
    },
    onComplete: (clientConfig) => {
      registerAppContext(this, clientConfig);
    },
    args: () => [],
  });

  createRenderRoot() {
    return this;
  }

  render() {
    return this.viewerInitialization.render({
      pending: () => html`<p>Loading</p>`,
      complete: () => html` <ngm-app></ngm-app>`,

      error: (e) => html`<p>Error: ${e}</p>`,
    });
  }
}
