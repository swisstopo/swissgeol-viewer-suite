import { BaseLayerController } from 'src/features/layer/new/controllers/layer.controller';
import { BackgroundLayer, WmtsLayer } from 'src/features/layer';
import { WmtsLayerController } from 'src/features/layer/new/controllers/layer-wmts.controller';
import { WmtsService } from 'src/services/wmts.service';
import { Id } from 'src/models/id.model';
import { DEFAULT_VIEW } from 'src/constants';
import * as Cesium from 'cesium';
import { Color } from 'cesium';

export class BackgroundLayerController extends BaseLayerController<BackgroundLayer> {
  private children = new Map<Id<WmtsLayer>, WmtsLayerController>();

  get type(): 'Background' {
    return 'Background';
  }

  protected reactToChanges(): void {
    // Reload the layers when the active variant changes.
    this.watch(this.layer.activeVariantId);

    // Change the globe's translucency when the opacity changes.
    // Note that this impacts *all* imageries - there is no way to separate them from the globe.
    this.watch(this.layer.opacity, (opacity) => {
      this.viewer.scene.globe.translucency.frontFaceAlphaByDistance =
        new Cesium.NearFarScalar(
          1.0,
          opacity, // near, alpha
          1.0e7,
          opacity, // far, alpha
        );
    });

    // Show or hide the globe based on the background visibility.
    // This is what allows us to view underground layers.
    // Note that simply making the map transparent is not enough here,
    // as that would not allow us to pick through the terrain.
    this.watch(this.layer.isVisible, (isVisible) => {
      this.viewer.scene.globe.show = isVisible;
    });
  }

  protected async addToViewer(): Promise<void> {
    const { viewer, layer, children } = this;

    // Remove all previous children.
    for (const child of children.values()) {
      child.remove();
    }
    children.clear();

    // Initialize the child layers.
    // These are the actual Cesium layers, defined by the currently active background variant.
    // Note that these are simple WMTS layers.
    const wmtsService = WmtsService.get();
    const childIds = layer.variants.get(layer.activeVariantId)!.children;
    for (const childId of childIds) {
      const childLayer = wmtsService.layer(childId);
      if (childLayer === null) {
        throw new Error(`Unknown background child layer: ${childId}`);
      }
      const childController = new WmtsLayerController({
        ...childLayer,

        // Opacity and visibility are directly set on the globe.
        // There is no way to detach globe and imagery, so updating both would essentially just double the opacity.
        // Instead, we set default values here and just modify the globe.
        opacity: 1.0,
        isVisible: true,
      });
      this.children.set(childId, childController);
      await childController.add();
    }

    // After adding the layers, they may be covering over, pre-existing imageries.
    // To negate this, we raise all other imageries over our child layers.
    let index = 0;
    const childLayers = new Set(
      [...this.children.values()].map((it) => it.imagery),
    );
    for (let i = 0; i < viewer.scene.imageryLayers.length; i++) {
      const imagery = viewer.scene.imageryLayers.get(index);
      const isChild = childLayers.has(imagery);
      if (isChild) {
        index += 1;
      } else {
        viewer.scene.imageryLayers.raiseToTop(imagery);
      }
    }

    // Ensure that the globe can be made transparent.
    viewer.scene.globe.baseColor = Color.TRANSPARENT;
    viewer.scene.globe.translucency.enabled = true;
  }

  protected removeFromViewer(): void {
    for (const controller of this.children.values()) {
      controller.remove();
    }
    this.children.clear();
  }

  moveToTop(): void {
    // Iterate all children, with the first being the lowermost one.
    // Note that this is *inverse* to how the LayerService works.
    const children = this.layer.variants.get(
      this.layer.activeVariantId,
    )!.children;
    for (const childId of children) {
      this.children.get(childId)?.moveToTop();
    }
  }

  zoomIntoView(): void {
    // Zooming to the background is equivalent to resetting the view.
    this.viewer.camera.flyTo({
      ...DEFAULT_VIEW,
    });
  }
}
