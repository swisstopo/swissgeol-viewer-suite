import { CoreElement } from 'src/features/core';
import { customElement, state } from 'lit/decorators.js';
import i18next from 'i18next';
import { css, html } from 'lit';
import { PropertyValues } from '@lit/reactive-element';
import { consume } from '@lit/context';
import { ControlsService } from 'src/features/controls/controls.service';

@customElement('control-2d')
export class Controls2dAction extends CoreElement {
  @consume({ context: ControlsService.context() })
  accessor controlsService!: ControlsService;

  @state()
  private accessor isActive = false;

  connectedCallback(): void {
    super.connectedCallback();
    this.role = 'button';
    this.addEventListener('click', this.toggle);

    this.controlsService.is2DActive$.subscribe((isActive) => {
      this.isActive = isActive;
    });
  }

  update(changedProperties: PropertyValues<this>): void {
    super.update(changedProperties);
    this.title = i18next.t('nav_target_point');
    this.classList.toggle('is-active', this.isActive);
  }

  private readonly toggle = () => {
    this.controlsService.set2DActive(!this.controlsService.is2DActive);
  };

  readonly render = () =>
    html`<ngm-core-icon icon="${this.isActive ? '3d' : '2d'}"></ngm-core-icon>`;

  static readonly styles = css`
    :host {
      color: var(--ngm-interaction);
      display: flex;
      justify-content: center;
      align-items: center;
    }

    :host(.is-active) {
      color: var(--ngm-interaction-active);
    }
  `;
}
