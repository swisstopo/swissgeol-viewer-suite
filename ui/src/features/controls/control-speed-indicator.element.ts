import { CoreElement } from 'src/features/core';
import { customElement, state } from 'lit/decorators.js';
import { css, html } from 'lit';
import { consume } from '@lit/context';
import i18next from 'i18next';
import { KeyboardNavigationService } from 'src/features/controls/keyboard-navigation.service';

const DISPLAY_DURATION_MS = 2000;

/**
 * Overlay that shows the keyboard navigation speed for 2 seconds
 * after it has been changed.
 */
@customElement('control-speed-indicator')
export class ControlSpeedIndicator extends CoreElement {
  @consume({ context: KeyboardNavigationService.context() })
  accessor keyboardNavigationService!: KeyboardNavigationService;

  @state()
  private accessor speed = 0;

  @state()
  private accessor isVisible = false;

  private hideTimeout: ReturnType<typeof setTimeout> | undefined;

  connectedCallback(): void {
    super.connectedCallback();

    this.register(
      this.keyboardNavigationService.speedChange$.subscribe((speed) => {
        this.speed = speed;
        this.isVisible = true;
        clearTimeout(this.hideTimeout);
        this.hideTimeout = setTimeout(() => {
          this.isVisible = false;
        }, DISPLAY_DURATION_MS);
      }),
    );
  }

  disconnectedCallback(): void {
    clearTimeout(this.hideTimeout);
    super.disconnectedCallback();
  }

  readonly render = () => {
    const { minSpeed, maxSpeed } = this.keyboardNavigationService;
    const percent = Math.round(
      ((this.speed - minSpeed) / (maxSpeed - minSpeed)) * 100,
    );
    return html`<div class="indicator ${this.isVisible ? 'is-visible' : ''}">
      <div class="label">
        ${i18next.t('lsb_camera_speed')}:
        ${this.keyboardNavigationService.speedFactor.toFixed(2)}x
      </div>
      <div class="bar"><div class="fill" style="width: ${percent}%"></div></div>
    </div>`;
  };

  static readonly styles = css`
    :host {
      position: absolute;
      left: 50%;
      bottom: 120px;
      transform: translateX(-50%);
      pointer-events: none;
      z-index: 10;
    }

    .indicator {
      min-width: 180px;
      padding: 10px 16px;
      border-radius: 8px;
      background: rgba(30, 30, 30, 0.8);
      color: #fff;
      font-size: 14px;
      text-align: center;
      opacity: 0;
      transition: opacity 0.3s;
    }

    .indicator.is-visible {
      opacity: 1;
    }

    .bar {
      margin-top: 6px;
      height: 4px;
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.3);
    }

    .fill {
      height: 100%;
      border-radius: 2px;
      background: #fff;
    }
  `;
}
