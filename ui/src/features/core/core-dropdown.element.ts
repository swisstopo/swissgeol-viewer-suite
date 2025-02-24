import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CoreBasePopup } from 'src/features/core/base/core-base-popup.element';
import { CoreDropdownBox } from 'src/features/core/core-dropdown-box.element';
import { CoreButton } from 'src/features/core/core-button.element';

@customElement('ngm-core-dropdown')
export class CoreDropdown extends CoreBasePopup<CoreDropdownBox> {
  readonly defaultPosition = 'bottom';

  readonly defaultAlign = 'start';

  readonly enterEvents = ['click'];

  readonly leaveEvents = ['click'];

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

    document.addEventListener('click', this.hide);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('click', this.hide);
  }

  override show(event?: Event): void {
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
