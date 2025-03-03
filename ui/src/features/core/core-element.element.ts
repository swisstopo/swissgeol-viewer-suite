import { LitElement } from 'lit';
import { state } from 'lit/decorators.js';
import i18next from 'i18next';
import { Subscription, TeardownLogic } from 'rxjs';
import { PropertyValues } from '@lit/reactive-element';
import { bindMethods } from 'src/utils/bind';

export class CoreElement extends LitElement {
  @state()
  protected accessor language!: string;

  private readonly _subscription = new Subscription();

  constructor() {
    super();

    bindMethods(this);
  }

  public connectedCallback() {
    const handleLanguageChanged = (language) => {
      this.language = language;
    };
    i18next.on('languageChanged', handleLanguageChanged);
    this._subscription.add(() => i18next.off('languageChanged', handleLanguageChanged));

    super.connectedCallback();
  }

  public disconnectedCallback() {
    super.disconnectedCallback();
    this._subscription.unsubscribe();
  }

  public willUpdate(_changedProperties: PropertyValues): void {
    if (!this.hasUpdated) {
      this.willFirstUpdate();
    }
  }

  public willFirstUpdate(): void {
    /* Empty method to be implemented by child classes. */
  }

  protected register(teardown: TeardownLogic): void {
    this._subscription.add(teardown);
  }
}
