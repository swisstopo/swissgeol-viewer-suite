import i18next from 'i18next';
import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CoreElement } from 'src/features/core';
import MainStore from 'src/store/main';

@customElement('ngm-app-settings')
export class AppSettings extends CoreElement {
  @state()
  accessor isDebugActive = false;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();

    this.register(
      MainStore.isDebugActive$.subscribe((isDebugActive) => {
        this.isDebugActive = isDebugActive;
      }),
    );
  }

  private readonly toggleDebug = (e: InputEvent) => {
    const isDebugActive = (e.target as HTMLInputElement).checked;
    MainStore.isDebugActive$.next(isDebugActive);
  };

  readonly render = () => html`
    <div class="toolbar-settings">
      <div class="inner-toolbar-settings">
        <label>${i18next.t('lsb_debug_tools')}</label>
        <div
          class="ngm-checkbox ngm-debug-tools-toggle ${classMap({
            active: this.isDebugActive,
          })}"
          @click=${() =>
            (<HTMLInputElement>(
              this.querySelector('.ngm-debug-tools-toggle > input')
            )).click()}
        >
          <input
            type="checkbox"
            ?checked=${this.isDebugActive}
            @change="${this.toggleDebug}"
          />
          <span class="ngm-checkbox-icon"></span>
          <label>${i18next.t('lsb_cesium_toolbar_label')}</label>
        </div>
        <a
          class="contact-mailto-link"
          target="_blank"
          href="mailto:swissgeol@swisstopo.ch"
          >${i18next.t('contact_mailto_text')}</a
        >
        <a
          class="disclaimer-link"
          target="_blank"
          href="${i18next.t('disclaimer_href')}"
          >${i18next.t('disclaimer_text')}</a
        >
      </div>
    </div>
  `;
}
