import { LitElement } from 'lit';
import { state } from 'lit/decorators.js';
import i18next from 'i18next';
import { Subscription, TeardownLogic } from 'rxjs';
import { PropertyValues } from '@lit/reactive-element';

export class CoreElement extends LitElement {
  @state()
  private accessor language!: string;

  private _subscription = new Subscription();

  connectedCallback() {
    const handleLanguageChanged = (language) => {
      this.willChangeLanguage(language);
      this.language = language;
    };
    i18next.on('languageChanged', handleLanguageChanged);
    this._subscription.add(() =>
      i18next.off('languageChanged', handleLanguageChanged),
    );

    super.connectedCallback();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._subscription.unsubscribe();
    this._subscription = new Subscription();
  }

  willUpdate(_changedProperties: PropertyValues): void {
    if (!this.hasUpdated) {
      this.willFirstUpdate();
    }
  }

  willFirstUpdate(): void {
    /* Empty method to be implemented by child classes. */
  }

  willChangeLanguage(_language: void) {
    /* Empty method to be implemented by child classes. */
  }

  protected register(teardown: TeardownLogic): void {
    this._subscription.add(teardown);
  }
}
