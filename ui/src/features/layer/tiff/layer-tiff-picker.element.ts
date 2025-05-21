import { customElement } from 'lit/decorators.js';
import { CoreElement, CoreWindow } from 'src/features/core';
import { css, html, PropertyValues } from 'lit';
import MainStore from 'src/store/main';
import { Entity, ImageryLayer, Viewer } from 'cesium';
import {
  isLayerTiffImagery,
  LayerTiffImagery,
  PickData,
} from 'src/features/layer';
import { Subscription } from 'rxjs';
import i18next from 'i18next';
import * as Cesium from 'cesium';

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

    this.highlight = this.viewer.entities.add({
      position: data.coordinates,
      billboard: {
        image:
          'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="rgba(120,255,52,0.6)"/></svg>',
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
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
    this.viewer.flyTo(this.highlight).then();
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
