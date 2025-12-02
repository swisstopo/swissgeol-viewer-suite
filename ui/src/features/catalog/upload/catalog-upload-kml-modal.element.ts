import { css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { applyTypography } from 'src/styles/theme';
import { KmlUploadEventDetail } from './catalog-upload-kml.element';
import i18next from 'i18next';
import { CoreElement } from 'src/features/core';

@customElement('ngm-catalog-upload-kml-modal')
export class CatalogUploadKmlModal extends CoreElement {
  @property({ type: File })
  accessor file: File | null = null;

  @state()
  accessor isClampEnabled = false;

  private cancel(): void {
    this.dispatchEvent(new CustomEvent('cancel'));
  }

  private confirm(): void {
    if (this.file == null) {
      throw new Error("Can't upload, no file selected.");
    }
    this.dispatchEvent(
      new CustomEvent<KmlUploadEventDetail>('confirm', {
        detail: {
          file: this.file,
          isClampEnabled: this.isClampEnabled,
        },
      }),
    );
  }

  render = () => html`
    <h2>${i18next.t('catalog:upload.modal.title')}</h2>
    <hr />
    <div class="file">${this.file!.name}</div>
    <hr />
    <div class="options">
      <ngm-core-checkbox
        .isActive="${this.isClampEnabled}"
        @update=${() => (this.isClampEnabled = !this.isClampEnabled)}
      >
        ${i18next.t('catalog:upload.modal.should_clamp_to_ground')}
      </ngm-core-checkbox>
    </div>
    <div class="actions">
      <ngm-core-button variant="secondary" @click="${this.cancel}">
        ${i18next.t('cancel')}
      </ngm-core-button>
      <ngm-core-button variant="primary" @click="${this.confirm}">
        ${i18next.t('catalog:upload.modal.confirm')}
      </ngm-core-button>
    </div>
  `;

  static readonly styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    hr {
      margin: 0;
      height: 1px;
      border-width: 0;
      color: var(--color-border--default);
      background-color: var(--color-border--default);
    }

    h2 {
      ${applyTypography('modal-title-1')}
      color: var(--color-text--emphasis-high);
      margin: 0;
    }

    .file {
      ${applyTypography('body-2')}
      color: var(--color-primary);
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 16px;
      margin-top: 8px;
    }
  `;
}
