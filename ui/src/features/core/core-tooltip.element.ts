import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CoreBasePopup } from 'src/features/core/base/core-base-popup.element';
import { CoreTooltipBox } from 'src/features/core/core-tooltip-box.element';

@customElement('ngm-core-tooltip')
export class CoreTooltip extends CoreBasePopup<CoreTooltipBox> {
  readonly defaultPosition = 'top';

  readonly defaultAlign = 'center';

  readonly enterEvents = ['pointerenter', 'focus'];

  readonly leaveEvents = ['pointerleave', 'blur'];

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

  readonly findBoxElement = () =>
    this.shadowRoot!.querySelector('ngm-core-tooltip-box')! as CoreTooltipBox;

  readonly renderBox = () => html`
    <ngm-core-tooltip-box></ngm-core-tooltip-box>
  `;
}
