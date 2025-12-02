import { css, LitElement, render } from 'lit';
import { property } from 'lit/decorators.js';
import { CoreBasePopupBox } from 'src/features/core/base/core-base-popup-box.element';

export interface PopupProps {
  position?: PopupPosition;

  align?: PopupAlign;
}

export abstract class CoreBasePopup<
  TBox extends CoreBasePopupBox,
> extends LitElement {
  @property({ type: String, reflect: true })
  accessor position: PopupPosition | null = null;

  @property({ type: String, reflect: true })
  accessor align: PopupAlign | null = null;

  @property({ type: Object })
  accessor content: unknown = null;

  private _target: Element | null = null;

  protected box!: TBox;

  private _isShown = false;

  protected constructor() {
    super();
    this.show = this.show.bind(this);
    this.hide = this.hide.bind(this);

    this.box = document.createElement(`${this.tagName}-box`) as TBox;
    this.box.hide();
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
    this.box.setTarget(target);
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
    document.body.appendChild(this.box);
    this.box.addEventListener('hide', this.hide);
    this.registerTarget();
  }

  disconnectedCallback(): void {
    this.unregisterTarget();
    this.box.removeEventListener('hide', this.hide);
    this.box.remove();
    this.hide();
    super.disconnectedCallback();
  }

  willUpdate(): void {
    render(this.content, this.box);
    this.box.style.setProperty('--count', `${this.box.childElementCount}`);
    this.updatePosition({ allowViewportCheck: true });
  }

  abstract get enterEvents(): string[];

  abstract get leaveEvents(): string[];

  get preventedEvents(): string[] {
    return [];
  }

  abstract get defaultPosition(): PopupPosition;

  abstract get defaultAlign(): PopupAlign;

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
    const box = this.box.getBoundingClientRect();
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

  readonly render = () => '';

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
