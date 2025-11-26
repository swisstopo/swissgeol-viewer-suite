import {
  BaseLayerController,
  mapLayerSourceToResource,
} from 'src/features/layer/controllers/layer.controller';
import { LayerType, Tiles3dLayer } from 'src/features/layer';
import {
  Cartesian2,
  Cesium3DTileset,
  CustomShader,
  CustomShaderTranslucencyMode,
  ImageBasedLighting,
  UniformType,
} from 'cesium';
import { OBJECT_HIGHLIGHT_NORMALIZED_RGB } from 'src/constants';
import { PickService, ScenePickingLock } from 'src/services/pick.service';

export class Tiles3dLayerController extends BaseLayerController<Tiles3dLayer> {
  private _tileset!: Cesium3DTileset;

  private scenePickingLock: ScenePickingLock | null = null;

  get type(): LayerType.Tiles3d {
    return LayerType.Tiles3d;
  }

  get tileset(): Cesium3DTileset {
    return this._tileset;
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
    this.watch(this.layer.opacity, (opacity, previousOpacity) => {
      if (opacity === 1 || previousOpacity === 1) {
        this.tileset.customShader = this.makeShader();
      } else {
        const shader = this.tileset.customShader!;
        shader.setUniform('u_alpha', opacity);
      }
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
      cullRequestsWhileMovingMultiplier: 100,
      preloadWhenHidden: false,
      preferLeaves: true,
      dynamicScreenSpaceError: true,
      foveatedScreenSpaceError: true,
      foveatedConeSize: 0.2,
      foveatedMinimumScreenSpaceErrorRelaxation: 3,
      foveatedTimeDelay: 0.2,
    });

    tileset.imageBasedLighting = new ImageBasedLighting();
    tileset.imageBasedLighting.imageBasedLightingFactor = new Cartesian2(1, 0);
    tileset.customShader = this.makeShader();

    const pickService = PickService.get();
    const scenePickingLock = pickService.acquireScenePickingLock();

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

    this._tileset = tileset;
    this.scenePickingLock = scenePickingLock;
    tileset.loadProgress.addEventListener(
      (numberOfPendingRequests: number, numberOfTilesProcessing: number) => {
        if (numberOfPendingRequests === 0 && numberOfTilesProcessing === 0) {
          this.scenePickingLock?.release();
          this.scenePickingLock = null;
        } else {
          this.scenePickingLock ??= pickService.acquireScenePickingLock();
        }
      },
    );
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
    this._tileset = undefined as unknown as Cesium3DTileset;

    this.scenePickingLock?.release();
    this.scenePickingLock = null;
  }

  private makeShader(): CustomShader {
    const { opacity } = this.layer;
    return new CustomShader({
      translucencyMode:
        opacity === 1
          ? CustomShaderTranslucencyMode.OPAQUE
          : CustomShaderTranslucencyMode.TRANSLUCENT,

      //language=glsl
      fragmentShaderText: `
        const float WHITE_CUTOFF = 0.985;

        bool isWhite(vec3 color) {
          return all(greaterThanEqual(color, vec3(WHITE_CUTOFF)));
        }

        void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
            material.specular = vec3(0.0);   // no view-dependent spec
            material.occlusion = 1.0;        // full diffuse
            material.alpha = u_alpha;
            if (u_isHighlighted) {
              material.diffuse = vec3(${OBJECT_HIGHLIGHT_NORMALIZED_RGB}); // highlight color
            }

            // Discard fully white (uncolored) fragments for partially transparent layers.
            if (u_isPartiallyTransparent && isWhite(material.baseColor.rgb)) {
              discard;
            }
          }
        `,
      uniforms: {
        u_alpha: {
          type: UniformType.FLOAT,
          value: opacity,
        },
        u_isHighlighted: {
          type: UniformType.BOOL,
          value: false,
        },
        u_isPartiallyTransparent: {
          type: UniformType.BOOL,
          value: this.layer.isPartiallyTransparent,
        },
      },
    });
  }
}
