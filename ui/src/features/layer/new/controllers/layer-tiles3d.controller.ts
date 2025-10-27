import {
  BaseLayerController,
  mapLayerSourceToResource,
} from 'src/features/layer/new/controllers/layer.controller';
import { LayerType, Tiles3dLayer } from 'src/features/layer';
import { Cesium3DTileset, Cesium3DTileStyle } from 'cesium';

export class Tiles3dLayerController extends BaseLayerController<Tiles3dLayer> {
  private tileset!: Cesium3DTileset;

  get type(): LayerType.Tiles3d {
    return LayerType.Tiles3d;
  }

  zoomIntoView(): void {
    this.viewer.flyTo(this.tileset).then();
  }

  moveToTop(): void {
    this.viewer.scene.primitives.raiseToTop(this.tileset);
  }

  protected reactToChanges(): void {
    this.watch(this.layer.source);

    // Apply opacity to the Cesium layer.
    this.watch(this.layer.opacity, (opacity) => {
      const color = `color("white", ${opacity})`;
      this.tileset.style = new Cesium3DTileStyle({ color });
    });

    // Show or hide the Cesium layer.
    this.watch(this.layer.isVisible, (isVisible) => {
      this.tileset.show = isVisible;
    });
  }

  protected async addToViewer(): Promise<void> {
    const resource = await mapLayerSourceToResource(this.layer.source);

    const tileset = await Cesium3DTileset.fromUrl(resource, {
      show: true,
      backFaceCulling: false,
      enableCollision: true,

      maximumScreenSpaceError: 16,
      cullWithChildrenBounds: true,
      cullRequestsWhileMoving: true,
      cullRequestsWhileMovingMultiplier: 100.0,
      preloadWhenHidden: false,
      preferLeaves: true,
      dynamicScreenSpaceError: true,
      foveatedScreenSpaceError: true,
      foveatedConeSize: 0.2,
      foveatedMinimumScreenSpaceErrorRelaxation: 3.0,
      foveatedTimeDelay: 0.2,
    });

    const { primitives } = this.viewer.scene;
    const i =
      this.tileset === null ? null : this.findIndexInPrimitives(this.tileset);
    if (i === null) {
      // Add a new Cesium layer.
      primitives.add(tileset);
    } else {
      // Replace an existing Cesium layer.
      this.removeFromViewer();
      primitives.add(tileset, i);
    }
    this.tileset = tileset;
    await this.update(this.layer);
  }

  protected removeFromViewer(): void {
    const { tileset } = this;
    if (tileset === undefined) {
      return;
    }
    this.viewer.scene.primitives.remove(tileset);
    if (!tileset.isDestroyed()) {
      tileset.destroy();
    }
    this.tileset = undefined as unknown as Cesium3DTileset;
  }
}
