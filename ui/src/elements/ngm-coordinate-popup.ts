import { LitElementI18n } from '../i18n';
import type { PropertyValues } from 'lit';
import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  Cartographic,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
} from 'cesium';
import MainStore from '../store/main';
import { formatCartographicAs2DLv95, radToDeg } from '../projection';
import i18next from 'i18next';
import { isLayerTiffImagery } from 'src/features/layer';
import { LayerTiffPicker } from 'src/features/layer/tiff/layer-tiff-picker.element';

@customElement('ngm-coordinate-popup')
export class NgmCoordinatePopup extends LitElementI18n {
  @state()
  accessor opened = false;
  @state()
  accessor coordinatesLv95: string[] = [];
  @state()
  accessor coordinatesWgs84: string[] = [];
  @state()
  accessor elevation = '';

  @state()
  accessor terrainDistance = '';

  private readonly integerFormat = new Intl.NumberFormat('de-CH', {
    maximumFractionDigits: 1,
  });

  connectedCallback() {
    MainStore.viewer.subscribe((viewer) => {
      if (viewer === null) {
        return;
      }

      const eventHandler = new ScreenSpaceEventHandler(viewer.canvas);

      eventHandler.setInputAction(async (event) => {
        this.opened = false;
        const cartesian = viewer.scene.pickPosition(event.position);
        if (!cartesian) {
          return;
        }

        const cartCoords = Cartographic.fromCartesian(cartesian);
        this.coordinatesLv95 = formatCartographicAs2DLv95(cartCoords);
        this.coordinatesWgs84 = [cartCoords.longitude, cartCoords.latitude].map(
          radToDeg,
        );
        this.elevation = this.integerFormat.format(
          cartCoords.height / viewer.scene.verticalExaggeration,
        );
        const altitude = viewer.scene.globe.getHeight(cartCoords) || 0;
        this.terrainDistance = this.integerFormat.format(
          Math.abs(cartCoords.height - altitude),
        );
        this.style.left = event.position.x + 'px';
        this.style.top = event.position.y + 10 + 'px';
        this.opened = true;
      }, ScreenSpaceEventType.RIGHT_CLICK);
      viewer.camera.moveStart.addEventListener(() => {
        if (this.opened) this.opened = false;
      });
      eventHandler.setInputAction(() => {
        if (this.opened) this.opened = false;
      }, ScreenSpaceEventType.LEFT_DOWN);

      eventHandler.setInputAction(async (event) => {
        const cartesian = viewer.scene.pickPosition(event.position);
        if (!cartesian) {
          return;
        }

        // This is kind of a hacky way to tell the tiffPicker that it should close its window.
        // Ideally, we would have a global service to which the picker could subscribe to by itself.
        // For now, this is much simpler and keeps everything related to picking in one place.
        // We should definitely refactor this if there are ever multiple elements wanting to be notified when a new pick starts.
        const tiffPicker = document.querySelector(
          'ngm-layer-tiff-picker',
        ) as LayerTiffPicker;
        tiffPicker.closeWindow();

        viewer.canvas.style.cursor = 'progress';
        for (let i = 0; i < viewer.scene.imageryLayers.length; i++) {
          const layer = viewer.scene.imageryLayers.get(i);
          if (isLayerTiffImagery(layer)) {
            const hasHit = await layer.controller.pick(cartesian);
            if (hasHit) {
              viewer.canvas.style.cursor = 'default';
              return;
            }
          }
        }
        viewer.canvas.style.cursor = 'default';
      }, ScreenSpaceEventType.LEFT_CLICK);
    });
    super.connectedCallback();
  }

  updated(changedProperties: PropertyValues) {
    if (changedProperties.has('opened') && this.opened) {
      const bbox = this.getBoundingClientRect();
      this.style.left = bbox.left - bbox.width / 2 + 'px';
    }
    super.updated(changedProperties);
  }

  createRenderRoot() {
    return this;
  }

  render() {
    this.hidden = !this.opened;
    return html` <div class="popup-arrow"></div>
      <div class="ngm-floating-window-header">
        ${i18next.t('map_position_label')}
        <div class="ngm-close-icon" @click=${() => (this.opened = false)}></div>
      </div>
      <div class="content-container">
        <table class="ui compact small very basic table">
          <tbody>
            <tr class="top aligned">
              <td class="key">CH1903+ / LV95</td>
              <td class="value">
                ${this.coordinatesLv95[0]}, ${this.coordinatesLv95[1]}
              </td>
            </tr>
            <tr class="top aligned">
              <td class="key">WGS 84 (lat/lon)</td>
              <td class="value">
                ${this.coordinatesWgs84[0]}, ${this.coordinatesWgs84[1]}
              </td>
            </tr>
            <tr class="top aligned">
              <td class="key">${i18next.t('map_elevation_label')}</td>
              <td class="value">${this.elevation} m</td>
            </tr>
            <tr class="top aligned">
              <td class="key">${i18next.t('map_terrain_distance_label')}</td>
              <td class="value">${this.terrainDistance} m</td>
            </tr>
          </tbody>
        </table>
      </div>`;
  }
}
