import i18next from 'i18next';
import { html, nothing, svg } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { CoreElement } from 'src/features/core';
import { CameraControllerService } from 'src/features/controls/camera-controller.service';
import {
  NAVIGATION_PROFILES,
  NavigationAction,
  NavigationStyle,
} from 'src/features/controls/navigation-style.model';
import { MouseButton } from 'cesium';

const NAVIGATION_ACTIONS: NavigationAction[] = ['orbit', 'pan', 'zoom'];

const ACTION_COLORS: Record<NavigationAction, string> = {
  orbit: '#3b82f6',
  zoom: '#16a34a',
  pan: '#f59e0b',
};

const NAVIGATION_STYLE_LABELS: ReadonlyArray<[NavigationStyle, string]> = [
  [NavigationStyle.Esri, 'lsb_navigation_style_esri'],
  [NavigationStyle.Modelling, 'lsb_navigation_style_modelling'],
  [NavigationStyle.RightOrbit, 'lsb_navigation_style_right_orbit'],
];

const WHEEL_KEY = Symbol('wheel');

const KEYBOARD_SHORTCUTS: ReadonlyArray<[Array<string | symbol>, string]> = [
  [['W', 'S'], 'lsb_keys_forward_backward'],
  [['A', 'D'], 'lsb_keys_left_right'],
  [['Space', 'Q', 'PgUp'], 'lsb_keys_up'],
  [['C', 'E', 'PgDn'], 'lsb_keys_down'],
  [['I', 'K', 'J', 'L'], 'lsb_keys_look'],
  [['↑', '↓', '←', '→'], 'lsb_keys_look'],
  [[',', '.'], 'lsb_keys_speed_change'],
  [['Shift'], 'lsb_keys_sprint'],
  [['Shift', WHEEL_KEY], 'lsb_keys_speed'],
  [['Esc'], 'lsb_keys_stop'],
];

const getActionOf = (
  profile: Record<NavigationAction, MouseButton>,
  button: MouseButton,
): NavigationAction =>
  NAVIGATION_ACTIONS.find((action) => profile[action] === button)!;

const WHEEL_ARROWS = svg`<path d="M30 11L26.5 16H33.5Z M30 29L26.5 24H33.5Z" fill="#fff" />`;

const ACTION_ICONS = {
  orbit: svg`<ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(-30 12 12)" /><path d="M18 17l3 1-1-3" />`,
  zoom: svg`<circle cx="10" cy="10" r="6" /><path d="M15 15l6 6M10 7v6M7 10h6" />`,
  pan: svg`<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />`,
};

@customElement('ngm-app-settings')
export class AppSettings extends CoreElement {
  @state()
  accessor navigationStyle = NavigationStyle.Esri;

  @consume({ context: CameraControllerService.context() })
  accessor cameraControllerService!: CameraControllerService;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();

    this.register(
      this.cameraControllerService.navigationStyle$.subscribe((style) => {
        this.navigationStyle = style;
      }),
    );
  }

  readonly render = () => html`
    <div class="toolbar-settings">
      <div class="inner-toolbar-settings">
        <label class="ngm-settings-title"
          >${i18next.t('lsb_navigation_title')}</label
        >
        <div class="ngm-navigation-settings">
          <div class="ngm-navigation-style-options">
            ${NAVIGATION_STYLE_LABELS.map(
              ([style, labelKey]) => html`
                <label class="ngm-navigation-style">
                  <input
                    type="radio"
                    name="navigation-style"
                    .checked=${this.navigationStyle === style}
                    @change=${() =>
                      this.cameraControllerService.setNavigationStyle(style)}
                  />
                  <span>${i18next.t(labelKey)}</span>
                </label>
              `,
            )}
          </div>
          ${this.renderMouseLegend(this.navigationStyle)}
        </div>
        <label class="ngm-settings-title"
          >${i18next.t('lsb_keyboard_shortcuts')}</label
        >
        <table class="ngm-keyboard-shortcuts">
          ${KEYBOARD_SHORTCUTS.map(
            ([keys, labelKey]) =>
              html`<tr>
                <td>
                  ${keys.map((key) =>
                    key === WHEEL_KEY
                      ? html`<kbd
                          >${this.renderWheelIcon('#6b7280', true)}</kbd
                        >`
                      : html`<kbd>${key}</kbd>`,
                  )}
                </td>
                <td>${i18next.t(labelKey)}</td>
              </tr>`,
          )}
        </table>
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

  private renderMouseLegend(style: NavigationStyle) {
    const profile = NAVIGATION_PROFILES[style];
    const wheelColor = ACTION_COLORS[getActionOf(profile, MouseButton.MIDDLE)];
    // The wheel always zooms and sits on the middle button's row. It only
    // shares that row if the middle button zooms as well.
    const isZoomOnWheel = profile.zoom === MouseButton.MIDDLE;
    return html`<div class="ngm-navigation-style-legend">
      ${this.renderMouse(profile)}
      <span class="ngm-navigation-style-actions">
        ${[...NAVIGATION_ACTIONS]
          .sort((a, b) => profile[a] - profile[b])
          .map((action) =>
            action === getActionOf(profile, MouseButton.MIDDLE)
              ? html`${this.renderAction(
                  isZoomOnWheel
                    ? html`${this.renderActionIcon(action)}${this.renderWheelIcon(
                        wheelColor,
                      )}`
                    : this.renderActionIcon(action),
                  action,
                )}${
                  isZoomOnWheel
                    ? nothing
                    : this.renderAction(
                        this.renderWheelIcon(wheelColor),
                        'zoom',
                      )
                }`
              : this.renderAction(this.renderActionIcon(action), action),
          )}
      </span>
    </div>`;
  }

  private renderMouse(profile: Record<NavigationAction, MouseButton>) {
    const fillOf = (button: MouseButton) =>
      ACTION_COLORS[getActionOf(profile, button)];
    return html`<svg
      class="ngm-mouse-schematic"
      viewBox="0 0 60 70"
      width="84"
      height="98"
      aria-hidden="true"
    >
      ${svg`
        <path d="M4 30V26C4 12 14 4 28 4V30Z" fill="${fillOf(MouseButton.LEFT)}" />
        <path d="M32 4C46 4 56 12 56 26V30H32Z" fill="${fillOf(MouseButton.RIGHT)}" />
        <path d="M4 34H56V44C56 58 46 66 30 66C14 66 4 58 4 44Z" fill="#4b5563" />
        <rect x="24" y="8" width="12" height="24" rx="6" fill="${fillOf(MouseButton.MIDDLE)}" stroke="#fff" stroke-width="2" />
        ${WHEEL_ARROWS}
      `}
    </svg>`;
  }

  private renderAction(icon: unknown, action: NavigationAction) {
    return html`<span class="ngm-navigation-action"
      ><span class="ngm-navigation-action-icons">${icon}</span
      ><span>${i18next.t(`lsb_navigation_action_${action}`)}</span></span
    >`;
  }

  private renderWheelIcon(color: string, isFine = false) {
    const size = isFine ? 16 : 24;
    const strokeWidth = isFine ? 1.2 : 2;
    const arrows = isFine
      ? 'M12 5.5L9.5 9H14.5Z M12 18.5L9.5 15H14.5Z'
      : 'M12 4L8.5 9H15.5Z M12 20L8.5 15H15.5Z';
    return html`<svg viewBox="0 0 24 24" width="${size}" height="${size}">
      ${svg`<rect x="6" y="1" width="12" height="22" rx="6" fill="none" stroke="${color}" stroke-width="${strokeWidth}" />
      <path d="${arrows}" fill="${color}" />`}
    </svg>`;
  }

  private renderActionIcon(action: NavigationAction) {
    return html`<svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="${ACTION_COLORS[action]}"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      ${ACTION_ICONS[action]}
    </svg>`;
  }
}
