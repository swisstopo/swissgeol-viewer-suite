import { customElement } from 'lit/decorators.js';
import { CoreElement, CoreWindow } from 'src/features/core';
import { css, html, PropertyValues } from 'lit';
import MainStore from 'src/store/main';
import * as Cesium from 'cesium';
import {
  Cartesian3,
  Cartographic,
  EllipsoidGeodesic,
  Entity,
  ImageryLayer,
  JulianDate,
  Viewer,
} from 'cesium';
import {
  isLayerTiffImagery,
  LayerTiffImagery,
  PickData,
} from 'src/features/layer';
import { Subscription } from 'rxjs';
import i18next from 'i18next';

@customElement('ngm-layer-tiff-picker')
export class LayerTiffPicker extends CoreElement {
  private viewer!: Viewer;

  private infoWindow: CoreWindow | null = null;
  private highlight: Entity | null = null;

  private readonly pickSubscriptions = new Map<
    LayerTiffImagery,
    Subscription
  >();

  connectedCallback(): void {
    super.connectedCallback();
    this.register(
      MainStore.viewer.subscribe((viewer) => {
        this.viewer = viewer!;
        const layers = this.viewer.scene.imageryLayers;
        for (let i = 0; i < layers.length; i++) {
          this.handleLayerAdded(layers.get(i));
        }
        this.register(
          layers.layerAdded.addEventListener(this.handleLayerAdded),
        );

        this.register(
          layers.layerRemoved.addEventListener(this.handleLayerRemoved),
        );
      }),
    );

    this.register(() => {
      for (const subscription of this.pickSubscriptions.values()) {
        subscription.unsubscribe();
      }
      this.pickSubscriptions.clear();
    });
  }

  private readonly handleLayerAdded = (layer: ImageryLayer): void => {
    if (!isLayerTiffImagery(layer)) {
      return;
    }
    const subscription = layer.controller.pick$.subscribe(this.handlePick);
    this.pickSubscriptions.set(layer, subscription);
  };

  private readonly handleLayerRemoved = (layer: ImageryLayer): void => {
    if (!isLayerTiffImagery(layer)) {
      return;
    }
    const subscription = this.pickSubscriptions.get(layer);
    if (subscription !== undefined) {
      subscription.unsubscribe();
      this.pickSubscriptions.delete(layer);
    }
  };

  private readonly handlePick = (data: PickData): void => {
    if (this.infoWindow !== null) {
      this.infoWindow.close();
    }

    const centerCarto = Cartographic.fromCartesian(data.coordinates);
    const geodesic = new EllipsoidGeodesic();

    function offsetPosition(
      carto: Cartographic,
      dNorth: number,
      dEast: number,
    ) {
      const delta = Cesium.Math.toRadians(0.00001);

      geodesic.setEndPoints(
        carto,
        new Cartographic(carto.longitude, carto.latitude + delta),
      );
      const meterPerLat = geodesic.surfaceDistance / delta;

      geodesic.setEndPoints(
        carto,
        new Cartographic(carto.longitude + delta, carto.latitude),
      );
      const meterPerLon = geodesic.surfaceDistance / delta;

      const dLat = dNorth / meterPerLat;
      const dLon = dEast / meterPerLon;

      return Cesium.Ellipsoid.WGS84.cartographicToCartesian(
        new Cartographic(carto.longitude + dLon, carto.latitude + dLat),
      );
    }

    const offset = data.layer.metadata.cellSize / 2;

    // Calculate corners of a 10x10 rectangle, adjusted for the current projection.
    const positions = [
      offsetPosition(centerCarto, -offset, -offset),
      offsetPosition(centerCarto, -offset, offset),
      offsetPosition(centerCarto, offset, offset),
      offsetPosition(centerCarto, offset, -offset),
    ];

    this.highlight = this.viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        material: Cesium.Color.fromBytes(120, 255, 52, Math.round(0.6 * 255)),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        perPositionHeight: false,
      },
    });

    this.infoWindow = CoreWindow.open({
      title: () => i18next.t('layers:geoTIFF.infoWindow.title'),
      body: () => html`
        <ngm-layer-tiff-info
          .data="${data}"
          @zoom="${this.zoomToData}"
        ></ngm-layer-tiff-info>
      `,
      onClose: () => {
        this.infoWindow = null;

        if (this.highlight !== null) {
          this.viewer.entities.remove(this.highlight);
          this.highlight = null;
        }
      },
    });
  };

  private readonly zoomToData = (): void => {
    if (this.highlight === null) {
      return;
    }
    const position: Cartographic =
      this.highlight.properties!.pickCartographic.getValue(JulianDate.now());
    this.viewer.camera.flyTo({
      destination: Cartesian3.fromRadians(
        position.longitude,
        position.latitude,
        position.height + 1000,
      ),
    });
  };

  closeWindow(): void {
    this.infoWindow?.close();
  }

  protected updated(_changedProperties: PropertyValues) {
    this.infoWindow?.rerender();
  }

  static readonly styles = css`
    :host {
      display: none;
    }
  `;
}
