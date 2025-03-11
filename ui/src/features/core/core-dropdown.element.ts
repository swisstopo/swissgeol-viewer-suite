import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CoreBasePopup } from 'src/features/core/base/core-base-popup.element';
import { CoreDropdownBox } from 'src/features/core/core-dropdown-box.element';
import { CoreButton } from 'src/features/core/core-button.element';
import { Subject, Subscription } from 'rxjs';

@customElement('ngm-core-dropdown')
export class CoreDropdown extends CoreBasePopup<CoreDropdownBox> {
  readonly defaultPosition = 'bottom';

  readonly defaultAlign = 'start';

  readonly enterEvents = ['click'];

  readonly leaveEvents = ['click'];

  private subscription: Subscription | null = null;

  /**
   * A subject that any dropdown writes to when it is opened.
   * Any other dropdown - other than that writer - should then close,
   * so that only one dropdown can be open at once.
   * @private
   */
  private static readonly opened$ = new Subject<void>();

  get preventedEvents(): string[] {
    return [
      'mousedown',
      'mouseup',
      'touchstart',
      'touchend',
      'pointerdown',
      'pointerup',
    ];
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.subscription = new Subscription();

    this.subscription.add(
      CoreDropdown.opened$.subscribe(() => {
        this.hide();
      }),
    );

    const hideOnDocumentClick = () => this.hide();
    document.addEventListener('click', hideOnDocumentClick);
    this.subscription.add(() => {
      document.removeEventListener('click', hideOnDocumentClick);
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.subscription?.unsubscribe();
  }

  override show(event?: Event): void {
    if (this.isShown || this.box == null) {
      return;
    }
    CoreDropdown.opened$.next();
    super.show(event);
    if (this.target instanceof CoreButton) {
      this.target.isActive = true;
    }
  }

  override hide(event?: Event): void {
    super.hide(event);
    if (this.target instanceof CoreButton) {
      this.target.isActive = false;
    }
  }

  readonly findBoxElement = () => {
    return this.shadowRoot!.querySelector(
      'ngm-core-dropdown-box',
    )! as CoreDropdownBox;
  };

  readonly renderBox = () => html`
    <ngm-core-dropdown-box></ngm-core-dropdown-box>
  `;

  static readonly styles = css`
    ${CoreBasePopup.styles}
  `;
}
