import i18next from 'i18next';
import { html } from 'lit';
import { customElement, property, query, queryAll } from 'lit/decorators.js';
import { LitElementI18n } from '../i18n';
import draggable from './draggable';
import { dragArea } from './helperElements';
import {
  createLithologyIncludeUniform,
  getVoxelShader,
} from '../layers/voxels-helper';
import { repeat } from 'lit/directives/repeat.js';
import { TextureUniform, Viewer } from 'cesium';
import { LayerConfig, LithologyVoxelFilter } from '../layertree';
import { PropertyValues } from '@lit/reactive-element';

@customElement('ngm-voxel-filter')
export class NgmVoxelFilter extends LitElementI18n {
  @property({ type: Object })
  accessor config: LayerConfig | undefined;

  @property({ type: Object })
  accessor viewer!: Viewer;

  @query('.min-conductivity')
  accessor minConductivityInput!: HTMLInputElement;

  @query('.max-conductivity')
  accessor maxConductivityInput!: HTMLInputElement;

  @query('.vox_filter_include_undefined')
  accessor includeUndefinedConductivity: HTMLInputElement | null = null;

  @queryAll('.lithology-checkbox input[type="checkbox"]')
  accessor lithologyCheckbox!: NodeListOf<HTMLInputElement>;

  private minConductivity = NaN;
  private maxConductivity = NaN;

  private minConductivityValue = NaN;
  private maxConductivityValue = NaN;

  private isLithologyActiveByIndex: boolean[] = [];

  shouldUpdate(): boolean {
    return this.config !== undefined;
  }

  update(changedProperties: PropertyValues<this>): void {
    this.classList.toggle('is-klasse', this.isKlasse);

    if (changedProperties.has('config') && this.config !== undefined) {
      this.initializeFromShader();
    }

    super.update(changedProperties);
  }

  private initializeFromShader(): void {
    const shader = getVoxelShader(this.config);

    this.minConductivity = shader.uniforms['u_filter_conductivity_min']
      .value as number;

    this.maxConductivity = shader.uniforms['u_filter_conductivity_max']
      .value as number;

    const lithologyUniform = shader.uniforms['u_filter_selected_lithology']
      .value as TextureUniform;
    this.isLithologyActiveByIndex = [
      ...(lithologyUniform as { typedArray: Uint8Array }).typedArray,
    ].map((value) => value === 1);

    if (this.includeUndefinedConductivity !== null) {
      this.includeUndefinedConductivity.checked = shader.uniforms[
        'u_filter_include_undefined_conductivity'
      ].value as boolean;
    }

    const operator = shader.uniforms['u_filter_operator'].value as number;
    const operatorInputs = this.querySelectorAll<HTMLInputElement>(
      'input[name="operator"]',
    );
    for (let i = 0; i < operatorInputs.length; i++) {
      const input = operatorInputs[i];
      input.checked = i === operator;
    }
  }

  willUpdate() {
    if (!this.config) return;
    this.minConductivityValue = this.minConductivity =
      this.config.voxelFilter!.conductivityRange[0];
    this.maxConductivityValue = this.maxConductivity =
      this.config.voxelFilter!.conductivityRange[1];

    this.hidden = false;
  }

  minConductivityChanged(evt) {
    this.minConductivity = parseFloat(evt.target.value);
    this.maxConductivityInput.min = this.minConductivity.toString();
  }

  maxConductivityChanged(evt) {
    this.maxConductivity = parseFloat(evt.target.value);
    this.minConductivityInput.max = this.maxConductivity.toString();
  }

  close() {
    this.hidden = true;
    this.isLithologyActiveByIndex = [];
    this.resetForm();

    this.config = undefined;
  }

  applyFilter() {
    this.updateUniform('u_filter_conductivity_min', this.minConductivity);
    this.updateUniform('u_filter_conductivity_max', this.maxConductivity);

    const lithologyInclude: number[] = [];
    this.lithologyCheckbox.forEach((checkbox) =>
      lithologyInclude.push(checkbox.checked ? 1 : 0),
    );

    const lithologyUniform = createLithologyIncludeUniform(lithologyInclude);

    this.updateUniform('u_filter_selected_lithology', lithologyUniform);

    const operator = this.querySelector<HTMLInputElement>(
      'input[name="operator"]:checked',
    );
    const value = operator ? parseInt(operator.value, 10) : 0;
    this.updateUniform('u_filter_operator', value);
    this.updateUniform(
      'u_filter_include_undefined_conductivity',
      this.includeUndefinedConductivity?.checked ?? true,
    );

    this.viewer.scene.requestRender();
  }

  private updateUniform(
    name: string,
    value: boolean | number | TextureUniform,
  ): void {
    const shader = getVoxelShader(this.config);
    // Update the uniform on the GPU.
    shader.setUniform(name, value);

    // Update the cached value so we can use it to retrieve the uniform state later on.
    shader.uniforms[name].value = value;
  }

  resetForm() {
    this.querySelectorAll<HTMLFormElement>('.content-container form').forEach(
      (form) => form.reset(),
    );
    if (this.includeUndefinedConductivity) {
      this.includeUndefinedConductivity.checked = true;
    }
  }

  firstUpdated() {
    draggable(this, {
      allowFrom: '.drag-handle',
    });
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }

  private get isKlasse(): boolean {
    return this.config!.voxelDataName === 'Klasse';
  }

  render() {
    const { isKlasse } = this;
    return html`
      <div class="ngm-floating-window-header drag-handle">
        ${i18next.t('vox_filter_filtering_on')} ${i18next.t(this.config!.label)}
        <div class="ngm-close-icon" @click=${() => this.close()}></div>
      </div>
      <div class="content-container">
        ${isKlasse ? '' : this.renderRangeFilters()}
        ${isKlasse ? '' : this.renderLogicalOperators()}
        ${this.renderLayerFilters({ isKlasse })}
        <div>
          <button
            class="ui button ngm-action-btn"
            @click="${() => this.applyFilter()}"
          >
            ${i18next.t('vox_filter_apply')}
          </button>
        </div>
      </div>
      ${dragArea}
    `;
  }

  private renderRangeFilters() {
    return html` <form class="ui form">
      <div class="filter-label">
        ${i18next.t('vox_filter_hydraulic_conductivity')}
      </div>
      <div class="two fields">
        <div class="field">
          <label>${i18next.t('vox_filter_min')}</label>
          <input
            required
            class="min-conductivity"
            type="number"
            step="0.01"
            value="${this.minConductivity}"
            min="${this.minConductivityValue}"
            max="${this.maxConductivity}"
            @input="${(evt) => this.minConductivityChanged(evt)}"
          />
        </div>
        <div class="field">
          <label>${i18next.t('vox_filter_max')}</label>
          <input
            required
            class="max-conductivity"
            type="number"
            step="0.01"
            value="${this.maxConductivity}"
            min="${this.minConductivity}"
            max="${this.maxConductivityValue}"
            @input="${(evt) => this.maxConductivityChanged(evt)}"
          />
        </div>
      </div>
      <div>
        <label>
          <input
            class="vox_filter_include_undefined"
            type="checkbox"
            value="fixme"
            checked
          />
          ${i18next.t('vox_filter_undefined_conductivity')}
        </label>
      </div>
    </form>`;
  }

  private renderLogicalOperators() {
    return html` <form class="ui form">
      <div class="inline fields">
        <div class="field">
          <div class="ui radio checkbox">
            <input
              type="radio"
              id="operator_and"
              name="operator"
              value="0"
              checked
            />
            <label for="operator_and">${i18next.t('vox_filter_and')}</label>
          </div>
        </div>
        <div class="field">
          <div class="ui radio checkbox">
            <input type="radio" id="operator_or" name="operator" value="1" />
            <label for="operator_or">${i18next.t('vox_filter_or')}</label>
          </div>
        </div>
        <div class="field">
          <div class="ui radio checkbox">
            <input type="radio" id="operator_xor" name="operator" value="2" />
            <label for="operator_xor">${i18next.t('vox_filter_xor')}</label>
          </div>
        </div>
      </div>
    </form>`;
  }

  private renderLayerFilters({ isKlasse }: { isKlasse: boolean }) {
    const hideCheckboxColor =
      this.config!.voxelDataName !== 'Index' && !isKlasse;
    return html`
      <form class="lithology-checkbox">
        <div class="lithology-filter-buttons">
          <button
            class="ui button"
            type="button"
            @click="${() => {
              this.lithologyCheckbox.forEach(
                (checkbox) => (checkbox.checked = true),
              );
            }}"
          >
            ${i18next.t('vox_filter_select_all')}
          </button>
          <button
            class="ui button"
            type="button"
            @click="${() => {
              this.lithologyCheckbox.forEach(
                (checkbox) => (checkbox.checked = false),
              );
            }}"
          >
            ${i18next.t('vox_filter_unselect_all')}
          </button>
        </div>
        <div class="filter-label">
          ${isKlasse
            ? i18next.t('vox_filter_klasse')
            : i18next.t('vox_filter_lithology')}
        </div>
        ${'lithology' in this.config!.voxelFilter!
          ? repeat(
              (this.config!.voxelFilter as LithologyVoxelFilter).lithology,
              (lithology) => lithology,
              (lithology, index: number) =>
                html` <label>
                  <input
                    type="checkbox"
                    value="${lithology.value}"
                    ?checked="${this.isLithologyActiveByIndex[index]}"
                    @input="${(e: InputEvent) =>
                      (this.isLithologyActiveByIndex[index] = (
                        e.target as HTMLInputElement
                      ).checked)}"
                  />
                  <div
                    ?hidden=${hideCheckboxColor}
                    style="background-color: ${this.config!.voxelColors?.colors[
                      index
                    ]}; width: 20px;"
                  ></div>
                  ${i18next.t(lithology.label)}
                </label>`,
            )
          : ''}
      </form>
    `;
  }
}
