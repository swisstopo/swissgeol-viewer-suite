import { LitElementI18n } from '../i18n';
import type { PropertyValues } from 'lit';
import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import * as Cesium from 'cesium';
import {
  Cartographic,
  ImageryLayerFeatureInfo,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
} from 'cesium';
import MainStore from '../store/main';
import { formatCartographicAs2DLv95, radToDeg } from '../projection';
import i18next from 'i18next';

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
  private eventHandler: ScreenSpaceEventHandler | undefined;
  private readonly integerFormat = new Intl.NumberFormat('de-CH', {
    maximumFractionDigits: 1,
  });

  connectedCallback() {
    MainStore.viewer.subscribe(async (viewer) => {
      if (!viewer) {
        return;
      }

      // const layer = await IonImageryProvider.fromAssetId(3094071);
      //
      // viewer.imageryLayers.addImageryProvider(layer);

      const band = 2;
      const colormapName = 'gnbu_r';
      const layer = new Cesium.UrlTemplateImageryProvider({
        url: `http://localhost:8481/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url=/data/output_3857_cog.tif&bidx=${band}&rescale=0,255&colormap_name=${colormapName}`,
        rectangle: Cesium.Rectangle.fromDegrees(
          7.30704928715091, // West longitude
          46.590097316038246, // South latitude
          7.964926907290575, // East longitude
          47.04103374247295, // North latitude
        ),
        tilingScheme: new Cesium.WebMercatorTilingScheme(),
        enablePickFeatures: true,
        credit: 'TiTiler',
        hasAlphaChannel: true,
      });

      const imagery = viewer.imageryLayers.addImageryProvider(layer);
      imagery.alpha = 0.75;
      layer.pickFeatures = async (x, y): Promise<ImageryLayerFeatureInfo[]> => {
        const url = `http://localhost:8481/cog/point/${x},${y}?url=/data/output_3857_cog.tif`;
        interface Json {
          coorridnates: [number, number];
          values: number[];
          band_names: string[];
        }

        const json: Json = await Cesium.Resource.fetchJson({ url });
        const info = new ImageryLayerFeatureInfo();
        info.imageryLayer = imagery;
        console.log(json);
        return [info];
      };

      viewer.screenSpaceEventHandler.setInputAction(async (event) => {
        const cartesian = viewer.scene.pickPosition(event.position);
        const coords = Cartographic.fromCartesian(cartesian);

        const longitude = Cesium.Math.toDegrees(coords.longitude);
        const latitude = Cesium.Math.toDegrees(coords.latitude);

        console.log({ longitude, latitude, coords });

        const out = await layer.pickFeatures(
          longitude,
          latitude,
          0,
          coords.longitude,
          coords.latitude,
        );
        console.log(out);
      }, ScreenSpaceEventType.LEFT_CLICK);

      this.eventHandler = new ScreenSpaceEventHandler(viewer.canvas);
      this.eventHandler.setInputAction((event) => {
        this.opened = false;
        const cartesian = viewer.scene.pickPosition(event.position);
        if (cartesian) {
          const cartCoords = Cartographic.fromCartesian(cartesian);
          this.coordinatesLv95 = formatCartographicAs2DLv95(cartCoords);
          this.coordinatesWgs84 = [
            cartCoords.longitude,
            cartCoords.latitude,
          ].map(radToDeg);
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
          return;
        }
      }, ScreenSpaceEventType.RIGHT_CLICK);
      viewer.camera.moveStart.addEventListener(() => {
        if (this.opened) this.opened = false;
      });
      this.eventHandler.setInputAction(() => {
        if (this.opened) this.opened = false;
      }, ScreenSpaceEventType.LEFT_DOWN);
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

  createRenderRoot() {
    return this;
  }
}
