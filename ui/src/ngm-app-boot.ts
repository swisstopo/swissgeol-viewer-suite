import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import './ngm-app';
import { Task } from '@lit/task';

import { ClientConfig } from './api/client-config';
import { registerAppContext } from './context';
import { ConfigService } from './api/config.service';

@customElement('ngm-app-boot')
export class NgmAppBoot extends LitElement {
  private isReady = false;

  private readonly viewerInitialization = new Task(this, {
    task: async () => {
      const clientConfig =
        (await new ConfigService().getConfig()) as ClientConfig;
      if (!clientConfig) {
        throw new Error('Failed to load client config');
      }
      return clientConfig;
    },
    args: () => [],
  });

  updated() {
    const { value: clientConfig } = this.viewerInitialization;
    if (!this.isReady && clientConfig !== undefined) {
      setTimeout(() => {
        registerAppContext(this, clientConfig);
        this.isReady = true;
        this.requestUpdate();
      });
    }
  }

  // This deactivates shadow DOM. Because this is done for all other components, we have to add it for the time being.
  createRenderRoot() {
    return this;
  }

  render() {
    return this.viewerInitialization.render({
      pending: () => html`<p>Loading</p>`,
      complete: () =>
        this.isReady ? html`<ngm-app></ngm-app>` : html`<p>Loading</p>`,
      error: (e) => html`<p>Error: ${e}</p>`,
    });
  }
}
