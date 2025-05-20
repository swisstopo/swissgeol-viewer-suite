import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import {
  CoreBasePopup,
  PopupProps,
} from 'src/features/core/base/core-base-popup.element';
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
}

export function tooltip(content: unknown): unknown;
export function tooltip(props: PopupProps, content: unknown): unknown;
export function tooltip(
  propsOrContent: unknown,
  contentOrNone?: unknown,
): unknown {
  const content = contentOrNone ?? propsOrContent;
  const props =
    contentOrNone === undefined ? {} : (propsOrContent as PopupProps);
  return html`<ngm-core-tooltip
    .position="${props.position}"
    .align="${props.align}"
    .content="${content}"
  ></ngm-core-tooltip>`;
}
