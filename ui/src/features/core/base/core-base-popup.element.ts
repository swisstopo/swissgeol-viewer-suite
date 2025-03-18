import { css, html, LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { CoreBasePopupBox } from 'src/features/core/base/core-base-popup-box.element';

export abstract class CoreBasePopup<
  TBox extends CoreBasePopupBox,
> extends LitElement {
  @property()
  accessor position: PopupPosition | null = null;

  @property()
  accessor align: PopupAlign | null = null;

  private _target: Element | null = null;

  protected box: TBox | null = null;

  private isInitialized = false;

  private _isShown = false;

  protected constructor() {
    super();
    this.show = this.show.bind(this);
    this.hide = this.hide.bind(this);
  }

  get target(): Element | null {
    return this._target ?? this.previousElementSibling;
  }

  @property()
  set target(target: Element | null) {
    this.unregisterTarget();
    this._target = target;
    this.registerTarget();
  }

  get isShown(): boolean {
    return this._isShown;
  }

  private registerTarget(): void {
    const { target } = this;
    if (target == null) {
      return;
    }
    this.enterEvents.forEach((event) =>
      target.addEventListener(event, this.show),
    );
    this.leaveEvents.forEach((event) =>
      target.addEventListener(event, this.hide),
    );
    this.preventedEvents.forEach((event) =>
      target.addEventListener(event, stopEvent),
    );
  }

  private unregisterTarget(): void {
    const { target } = this;
    if (target == null) {
      return;
    }
    this.enterEvents.forEach((event) =>
      target.removeEventListener(event, this.show),
    );
    this.leaveEvents.forEach((event) =>
      target.removeEventListener(event, this.hide),
    );
    this.preventedEvents.forEach((event) =>
      target.removeEventListener(event, stopEvent),
    );
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (!this.isInitialized) {
      this.requestUpdate();
    }
  }

  async updated(): Promise<void> {
    if (!this.isInitialized) {
      this.initialize();
    }
  }

  disconnectedCallback(): void {
    this.unsyncSlot();
    this.hide();
    this.box?.remove();
    this.unregisterTarget();
    this.isInitialized = false;
    super.disconnectedCallback();
  }

  private initialize(): void {
    this.box ??= this.findBoxElement();
    document.body.appendChild(this.box);
    this.box.hide();
    this.box.addEventListener('hide', this.hide);

    this.syncSlot();

    if (this._target == null) {
      this.registerTarget();
    }
    this.isInitialized = true;
  }

  abstract get enterEvents(): string[];

  abstract get leaveEvents(): string[];

  get preventedEvents(): string[] {
    return [];
  }

  abstract get defaultPosition(): PopupPosition;

  abstract get defaultAlign(): PopupAlign;

  abstract findBoxElement(): TBox;

  private syncSlot(): void {
    if (this.box == null) {
      throw new Error(
        "can't sync slot as the box has not yet been initialized",
      );
    }
    const slot = this.shadowRoot!.querySelector('slot')!;
    const assignedNodes = slot.assignedNodes({ flatten: true });
    const box = this.box.shadowRoot!;
    while (box.lastChild != null) {
      box.removeChild(box.lastChild);
    }
    this.box.style.setProperty(
      '--count',
      `${assignedNodes.filter((it) => it instanceof HTMLElement).length}`,
    );
    if (assignedNodes.length === 0) {
      this.updatePosition();
      return;
    }
    this.updatePosition({ allowViewportCheck: true });
    assignedNodes.forEach((node) => {
      box.appendChild(node);
    });
    this.updatePosition({ allowViewportCheck: true });
  }

  private unsyncSlot(): void {
    if (this.box == null) {
      return;
    }
    const slot = this.shadowRoot!.querySelector('slot')!;
    slot.append(...this.box.shadowRoot!.childNodes);
  }

  protected show(event?: Event): void {
    if (this._isShown || this.box == null) {
      return;
    }
    event?.stopImmediatePropagation();
    this.box.show();
    this.updatePosition({ allowViewportCheck: true });
    this._isShown = true;
  }

  protected hide(event?: Event): void {
    if (!this._isShown || this.box == null) {
      return;
    }
    event?.stopImmediatePropagation();
    this.box.hide();
    this._isShown = false;
  }

  private updatePosition(
    options: { position?: PopupPosition; allowViewportCheck?: boolean } = {},
  ): void {
    if (this.target == null || this.box == null) {
      return;
    }

    const target = this.target.getBoundingClientRect();
    const box = this.box.getBoundingClientRect();

    const position = options.position ?? this.position ?? this.defaultPosition;
    const align = this.align ?? this.defaultAlign;
    const boxStyle = this.box.style;

    boxStyle.top = '';
    boxStyle.bottom = '';
    boxStyle.left = '';
    boxStyle.right = '';

    // Update x axis
    switch (position) {
      case 'top':
      case 'bottom':
        switch (align) {
          case 'center':
            boxStyle.left = `${target.x + target.width * 0.5 - box.width * 0.5}px`;
            break;
          case 'start':
            boxStyle.left = `${target.x}px`;
            break;
          case 'end':
            boxStyle.right = `${target.x + target.width}px`;
            break;
        }
        break;
      case 'left':
        boxStyle.left = `${target.x - box.width - FIXED_OFFSET_PX}px`;
        break;
      case 'right':
        boxStyle.left = `${target.x + target.width + FIXED_OFFSET_PX}px`;
        break;
    }

    // Update y axis
    switch (position) {
      case 'top':
        boxStyle.top = `${target.y - box.height - FIXED_OFFSET_PX}px`;
        break;
      case 'bottom':
        boxStyle.top = `${target.y + target.height + FIXED_OFFSET_PX}px`;
        break;
      case 'left':
      case 'right':
        switch (align) {
          case 'center':
            boxStyle.top = `${target.y + target.height * 0.5 - box.height * 0.5}px`;
            break;
          case 'start':
            boxStyle.top = `${target.y}px`;
            break;
          case 'end':
            boxStyle.bottom = `${target.y + target.height}px`;
            break;
        }
        break;
    }

    if (options.allowViewportCheck) {
      this.adjustPositionToViewport(position ?? this.defaultPosition);
    }
  }

  private adjustPositionToViewport(position: PopupPosition): void {
    const box = this.box!.getBoundingClientRect();
    switch (position) {
      case 'top':
        if (box.y < 0) {
          this.updatePosition({ position: 'bottom' });
        }
        break;
      case 'bottom':
        if (box.y + box.height > window.innerHeight) {
          this.updatePosition({ position: 'top' });
        }
        break;
      case 'left':
        if (box.x < 0) {
          this.updatePosition({ position: 'right' });
        }
        break;
      case 'right':
        if (box.x + box.width > window.innerWidth) {
          this.updatePosition({ position: 'left' });
        }
        break;
    }
  }

  abstract renderBox(): unknown;
  readonly render = () => {
    return html`
      <slot></slot>
      ${this.renderBox()}
    `;
  };

  static readonly styles = css`
    :host {
      display: none;
    }
  `;
}

export type PopupPosition = 'top' | 'bottom' | 'left' | 'right';

export type PopupAlign = 'start' | 'end' | 'center';

const FIXED_OFFSET_PX = 4;

const stopEvent = (event: Event): void => {
  event.stopPropagation();
};
