import { customElement, property } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { css, html, TemplateResult } from 'lit';
import {
  LayerInfo,
  LayerInfoAttribute,
} from 'src/features/layer/info/layer-info.model';
import i18next from 'i18next';
import { repeat } from 'lit/directives/repeat.js';
import { applyTypography } from 'src/styles/theme';
import { Viewer } from 'cesium';
import { viewerContext } from 'src/context';
import { consume } from '@lit/context';
import { TranslationKey } from 'src/models/translation-key.model';

const numberFormat = new Intl.NumberFormat('de-CH', {
  maximumFractionDigits: 20,
});

@customElement('ngm-layer-info-item')
export class LayerInfoItem extends CoreElement {
  @property({ type: Object })
  accessor info!: LayerInfo;

  @property({ type: Boolean })
  accessor isFirst!: boolean;

  private dragAnchorX: number | null = null;

  @consume({ context: viewerContext })
  accessor viewer!: Viewer;

  connectedCallback(): void {
    super.connectedCallback();

    this.addEventListener('mouseenter', () => {
      this.info.activateHighlight();
    });

    this.addEventListener('mouseleave', () => {
      this.info.deactivateHighlight();
    });

    document.addEventListener('mouseup', this.stopResizing);
    this.register(() =>
      document.removeEventListener('mouseup', this.stopResizing),
    );

    document.addEventListener('mousemove', this.drag);
    this.register(() => document.removeEventListener('mousemove', this.drag));
  }

  firstUpdated(): void {
    if (this.isFirst) {
      this.shadowRoot!.querySelector('input[type="checkbox"]')!.setAttribute(
        'checked',
        'checked',
      );
    }
  }

  private readonly zoomToObject = (): void => {
    this.info.zoomToObject();
  };

  private readonly startResizing = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    const baseOffsetPx = this.style.getPropertyValue('--divider-offset');
    const baseOffset =
      baseOffsetPx.length === 0 ? 0 : parseInt(baseOffsetPx.slice(0, -2));
    this.dragAnchorX = event.clientX + baseOffset;
  };

  private readonly stopResizing = () => {
    this.dragAnchorX = null;
  };

  private readonly drag = (event: MouseEvent) => {
    if (this.dragAnchorX === null) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    const offset = this.dragAnchorX - event.clientX;
    this.style.setProperty('--divider-offset', `${offset}px`);
  };

  private formatValue(
    value: LayerInfoAttribute['value'],
  ): string | TemplateResult {
    if (typeof value === 'number') {
      return numberFormat.format(value);
    }
    if (typeof value === 'string' || Array.isArray(value)) {
      return translate(value);
    }
    return value;
  }

  readonly render = () => html`
    <label class="toggle">
      <input type="checkbox" />
      ${i18next.t(this.info.title)}
      <sgc-icon name="chevronDown"></sgc-icon>
    </label>
    <div class="content">
      <sgc-button color="secondary" @click="${this.zoomToObject}">
        ${i18next.t('layers:infoWindow.zoomToObject')}
        <ngm-core-icon icon="zoomPlus"></ngm-core-icon>
      </sgc-button>
      <div class="attributes">
        <ul class="attribute-names">
          ${repeat(
            this.info.attributes,
            (it) => it.key,
            (it) => {
              const translatedKey = translate(it.key);
              return html`<li title="${translatedKey}">${translatedKey}</li>`;
            },
          )}
        </ul>
        <div class="divider" @mousedown="${this.startResizing}"></div>
        <ul class="attribute-values">
          ${repeat(
            this.info.attributes,
            (it) => it.key,
            (it) => {
              const value =
                typeof it.value === 'string' &&
                (it.value.startsWith('https://') ||
                  it.value.startsWith('http://'))
                  ? { url: it.value }
                  : it.value;
              if (typeof value === 'object' && 'url' in value) {
                return html`
                  <li>
                    <a
                      href="${value.url}"
                      title="${value.url}"
                      rel="external noopener nofollow"
                      target="_blank"
                      >${value.name ?? value.url}</a
                    >
                  </li>
                `;
              }
              const value = this.formatValue(it.value);
              return html`<li title="${value}">${value}</li>`;
            },
          )}
        </ul>
      </div>
    </div>
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    /* toggle */
    .toggle {
      cursor: pointer;
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      padding: 14px;
      gap: 12px;

      background: var(--sgc-color-bg--grey);
      border-radius: 4px;
      color: var(--sgc-color-primary);
    }

    .toggle > input[type='checkbox'] {
      display: none;
    }

    .toggle:has(input:checked) sgc-icon {
      transform: rotate(180deg);
    }

    /* content */
    .content {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-inline: 12px;
    }

    .toggle:not(:has(input:checked)) + .content {
      display: none;
    }

    /* attributes */
    .attributes {
      position: relative;
      display: grid;

      --divider-padding: 40px;

      grid-template-columns:
        clamp(
          var(--divider-padding),
          calc(50% - var(--divider-offset, 0px)),
          calc(100% - var(--divider-padding))
        )
        clamp(
          var(--divider-padding),
          calc(50% + var(--divider-offset, 0px)),
          calc(100% - var(--divider-padding))
        );
    }

    .attributes > .divider {
      position: absolute;
      cursor: col-resize;
      width: 10px;
      height: 100%;

      left: clamp(
        var(--divider-padding),
        calc(50% - 5px - var(--divider-offset, 0px)),
        calc(100% - var(--divider-padding))
      );

      &::before {
        position: absolute;
        content: ' ';
        display: block;
        width: 1px;
        height: 100%;

        left: 0;
        right: 0;
        margin-inline: auto;

        background-color: #337083;
      }
    }

    .attributes > ul {
      display: block;
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .attributes > ul > li {
      padding: 12px 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
      max-width: 100%;

      &:not(:last-child) {
        border-bottom: 1px solid var(--sgc-color-border--default);
      }
    }

    .attributes > ul.attribute-names {
      ${applyTypography('body-2-bold')}
    }

    .attributes > ul.attribute-values {
      ${applyTypography('body-2')}
    }

    .attributes > ul.attribute-values > li {
      padding-left: 16px;
    }
  `;
}

const translate = (key: string | TranslationKey) => {
  const keys = Array.isArray(key) ? [...key].reverse() : [key];
  return keys.reduce((prev, key) => {
    if (/^\w+:/.test(key)) {
      // Translation keys with spaces can't be translated with the `ns:key` syntax.
      // Do support them, we split the namespace from the key and pass it in the options object.
      const [ns, actualKey] = key.split(':', 2);
      return i18next.t(actualKey, { ns, defaultValue: prev });
    }
    return i18next.t(key, { defaultValue: prev });
  }, keys[0]);
};
