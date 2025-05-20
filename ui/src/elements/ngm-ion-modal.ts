import { customElement, state } from 'lit/decorators.js';
import { LitElementI18n } from '../i18n';
import { css, html } from 'lit';
import i18next from 'i18next';
import draggable from './draggable';
import { getAssets, IonAsset } from '../api-ion';
import MainStore from '../store/main';
import { showSnackbarConfirmation } from '../notifications';
import { getAssetIds } from '../permalink';
import { applyTypography } from 'src/styles/theme';
import { InputChangeEvent } from 'src/features/core/core-text-input.element';
import { repeat } from 'lit/directives/repeat.js';
import { classMap } from 'lit/directives/class-map.js';

const CESIUM_ION_DOCUMENTATION_URL =
  'https://cesium.com/learn/ion/cesium-ion-access-tokens/';

@customElement('ngm-ion-modal')
export class NgmIonModal extends LitElementI18n {
  @state()
  accessor token: string | null = MainStore.ionToken.value;
  @state()
  accessor assets: IonAsset[] = [];
  @state()
  accessor assetsToDisplay: IonAsset[] = [];
  @state()
  accessor assetsToAdd: Set<IonAsset> = new Set<IonAsset>();
  @state()
  accessor selectedIonAssetIds: Set<number> = new Set<number>();
  @state()
  accessor errorMessage: string | undefined;
  @state()
  accessor preloader = false;
  @state()
  accessor confirmationToast: HTMLElement | undefined;

  connectedCallback() {
    draggable(this, {
      allowFrom: '.drag-handle',
    });

    MainStore.selectedIonAssets.subscribe((ionAssetIds) => {
      this.selectedIonAssetIds = ionAssetIds;
    });
    super.connectedCallback();
  }

  get unselectedAssets(): IonAsset[] {
    return this.assets.filter(
      (asset) => !this.selectedIonAssetIds.has(asset.id),
    );
  }

  async onLoadAssets(removeAssets = false) {
    if (!this.token) return;
    this.confirmationToast = undefined;
    this.errorMessage = undefined;
    this.assets = [];
    this.assetsToDisplay = [];
    this.preloader = true;
    const res = await getAssets(this.token);
    if (res.items) {
      if (removeAssets) {
        MainStore.removeIonAssets();
      }
      MainStore.setIonToken(this.token);
      this.assets = res.items;
      this.assetsToDisplay = res.items;
    } else {
      this.errorMessage = res.message;
    }
    this.preloader = false;
  }

  loadAssets() {
    if (!this.token || this.confirmationToast || this.preloader) return;
    const currentToken = MainStore.ionToken.value;
    const assets = getAssetIds();
    if (currentToken !== this.token && assets.length) {
      this.confirmationToast = showSnackbarConfirmation(
        i18next.t('dtd_remove_assets_confirmation'),
        {
          onApprove: () => this.onLoadAssets(true),
          onDeny: () => (this.confirmationToast = undefined),
        },
      );
    } else {
      this.onLoadAssets();
    }
  }

  toggleSingleAsset(ionAsset: IonAsset) {
    const newSet = new Set(this.assetsToAdd);
    if (newSet.has(ionAsset)) {
      newSet.delete(ionAsset);
    } else {
      newSet.add(ionAsset);
    }
    this.assetsToAdd = newSet;
  }

  toggleAllAssets() {
    if (this.assetsToAdd.size === this.unselectedAssets.length) {
      this.assetsToAdd = new Set<IonAsset>();
    } else {
      this.assetsToAdd = new Set<IonAsset>(this.unselectedAssets);
    }
  }

  addAsset(ionAsset: IonAsset) {
    if (!ionAsset?.id || this.preloader) return;
    MainStore.addIonAssetId(ionAsset);
  }

  addAllSelectedAssets() {
    this.assetsToAdd.forEach((asset) => {
      this.addAsset(asset);
    });
    this.assetsToAdd.clear();
  }

  onClose() {
    if (this.confirmationToast) {
      this.confirmationToast.querySelector<HTMLElement>('.deny')?.click();
      this.confirmationToast = undefined;
    }
    this.dispatchEvent(new CustomEvent('close'));
  }

  setIonToken(event: InputChangeEvent) {
    this.token = event.detail.value;
  }

  searchForIonAssets(event: InputChangeEvent) {
    this.assetsToDisplay = this.assets.filter((asset) =>
      asset.name.toLowerCase().includes(event.detail.value.toLowerCase()),
    );
  }

  openCesiumDocs() {
    window.open(CESIUM_ION_DOCUMENTATION_URL, '_blank', 'noopener,noreferrer');
  }

  render() {
    return html`
      <h2 class="header">${i18next.t('dtd_add_ion_token')}</h2>
      <div class="content">
        <div .hidden=${this.assets.length}>
          <ngm-core-info-panel
            .icon=${'info'}
            .text=${i18next.t('dtd_ion_token_info')}
          ></ngm-core-info-panel>
        </div>
        <div class="token-input">
          <ngm-core-text-input
            .value=${this.token ?? ''}
            .label=${i18next.t('dtd_ion_token_label')}
            @inputChange="${this.setIonToken}"
          ></ngm-core-text-input>
          <sgc-button @buttonClick=${() => this.loadAssets()}
            >${i18next.t('dtd_load_ion_assets_btn')}</sgc-button
          >
        </div>
        <div .hidden=${!this.assets.length}>
          <hr />
        </div>
        <div .hidden=${!this.assets.length}>
          <div class="search-container">
            <sgc-button
              color="secondary"
              ?disabled=${this.assetsToAdd.size === 0}
              @buttonClick=${() => this.addAllSelectedAssets()}
            >
              <sgc-icon name="plus"></sgc-icon>
              ${i18next.t('dtd_add_ion_asset_btn')}
            </sgc-button>
            <ngm-core-text-input
              icon="search"
              .placeholder=${i18next.t('search_placeholder')}
              @inputChange="${this.searchForIonAssets}"
            ></ngm-core-text-input>
          </div>
          <table>
            <thead>
              <tr>
                <th class="table-column-checkbox">
                  <sgc-checkbox
                    .value="${this.assetsToAdd.size > 0}"
                    ?indeterminate="${this.assetsToAdd.size > 0 &&
                    this.assetsToAdd.size < this.unselectedAssets.length}"
                    @checkboxChange="${() => this.toggleAllAssets()}"
                  ></sgc-checkbox>
                </th>
                <th class="table-column-id">ID</th>
                <th class="table-column-value">
                  ${i18next.t('tbx_name_label')}
                </th>
                <th class="table-column-action"></th>
              </tr>
            </thead>
            <tbody>
              ${repeat(
                this.assetsToDisplay,
                (row) => row.id,
                (row) => html`
                  <tr
                    class="${classMap({
                      'is-active': this.assetsToAdd.has(row),
                    })}"
                  >
                    <td class="table-column-checkbox">
                      <sgc-checkbox
                        value="${this.assetsToAdd.has(row)}"
                        ?disabled="${this.selectedIonAssetIds.has(row.id)}"
                        @checkboxChange="${() => this.toggleSingleAsset(row)}"
                      ></sgc-checkbox>
                    </td>
                    <td class="table-column-id">${row.id}</td>
                    <td class="table-column-value">${row.name}</td>
                    <td class="table-column-action">
                      ${this.selectedIonAssetIds.has(row.id)
                        ? html`<sgc-icon name="checkmark"></sgc-icon>`
                        : // Replace button with sgc-button when new size has been added
                          html` <ngm-core-button
                            variant="secondary"
                            shape="small"
                            @click=${() => this.addAsset(row)}
                          >
                            <sgc-icon name="plus"></sgc-icon>
                            ${i18next.t('dtd_add_ion_asset_btn')}
                          </ngm-core-button>`}
                    </td>
                  </tr>
                `,
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div class="actions">
        <sgc-button
          color="tertiary"
          role="link"
          @buttonClick=${this.openCesiumDocs}
        >
          ${i18next.t('dtd_documentation')}
          <ngm-core-icon icon="documentation"></ngm-core-icon
        ></sgc-button>
        <sgc-button color="secondary" @buttonClick=${() => this.onClose()}
          >${i18next.t('app_close_btn_label')}</sgc-button
        >
      </div>
    `;
  }

  static readonly styles = css`
    :host {
      display: flex;
      flex-direction: column;
    }

    :host,
    :host * {
      box-sizing: border-box;
    }

    .header {
      border-bottom: 1px solid var(--sgc-color-border--default);
    }

    .header,
    .content,
    .actions {
      padding: 24px;
    }

    hr {
      margin: 0;
      height: 1px;
      border-width: 0;
      color: var(--sgc-color-border--default);
      background-color: var(--sgc-color-border--default);
    }

    h2 {
      ${applyTypography('modal-title-1')}
      color: var(--sgc-color-text--emphasis-high);
      margin: 0;
    }

    .content {
      display: flex;
      flex-direction: column;
      gap: 24px;
      max-height: 692px;
      overflow: auto;
      margin-bottom: 84px;
    }

    .token-input {
      display: flex;
      gap: 12px;

      sgc-button {
        padding-top: 30px;
      }

      ngm-core-text-input {
        flex: 1;
      }
    }

    .search-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 8px;

      ngm-core-text-input {
        width: 300px;
      }
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 16px;
      position: absolute;
      bottom: 0;
      background-color: white;
      width: 100%;
      border-top: 1px solid var(--sgc-color-border--default);
    }

    table {
      border-collapse: collapse;
    }

    tr:first-child th:first-child {
      border-top-left-radius: 4px;
    }

    tr:first-child th:last-child {
      border-top-right-radius: 4px;
    }

    table thead,
    tr.is-active {
      background-color: var(--sgc-color-border--default);
    }

    tbody tr {
      border: 1px solid var(--sgc-color-border--emphasis-high);
    }

    table th,
    table td {
      text-align: left;
    }

    table thead {
      border-bottom: 2px solid var(--sgc-color-border--emphasis-high);
    }

    tr td,
    tr th {
      height: 44px;
      text-align: left;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .table-column-checkbox {
      width: 44px;

      sgc-checkbox {
        position: relative;
      }
    }

    .table-column-id {
      width: 150px;
    }

    .table-column-value {
      max-width: 557px;
      width: 557px;
    }

    .table-column-action {
      width: 137px;
      text-align: right;
    }

    .table-column-id,
    .table-column-value {
      padding: 0 16px;
    }

    .table-column-checkbox,
    .table-column-action {
      padding: 0 11px;
    }
  `;
}
