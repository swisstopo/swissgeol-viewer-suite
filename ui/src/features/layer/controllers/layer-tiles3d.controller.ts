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
  Resource,
} from 'cesium';
import { OBJECT_HIGHLIGHT_NORMALIZED_RGB } from 'src/constants';
import { PickService, ScenePickingLock } from 'src/services/pick.service';

export class Tiles3dLayerController extends BaseLayerController<Tiles3dLayer> {
  private _tileset!: Cesium3DTileset;

  private scenePickingLock: ScenePickingLock | null = null;
  private originalTilesetJson: any = null;
  private baseUrl: string = '';
  private availableSlices: number[] = [];
  private currentBlobUrl: string | null = null;
  private isUpdatingSlices: boolean = false;
  private pendingSliceUpdate: number[] | null = null;
  private currentSliceIndices: [number, number, number] = [0, 0, 0]; // Indices for the three sliders

  get type(): LayerType.Tiles3d {
    return LayerType.Tiles3d;
  }

  get tileset(): Cesium3DTileset {
    return this._tileset;
  }

  /**
   * Get all available slice numbers for OGC tileset sources.
   */
  getAvailableSlices(): number[] {
    return this.availableSlices;
  }

  /**
   * Get the slice ranges for the three categories.
   * Returns [aufschnitte, seitenansichten, querschnitte] ranges.
   * Will be removed once we get the ranges from the backend
   */
  getSliceRanges(): [
    { start: number; end: number },
    { start: number; end: number },
    { start: number; end: number },
  ] {
    const total = this.availableSlices.length;
    const third = Math.floor(total / 3);

    return [
      { start: 0, end: third - 1 },
      { start: third, end: 2 * third - 1 },
      { start: 2 * third, end: total - 1 },
    ];
  }

  /**
   * Get current slice indices for the three sliders.
   */
  getCurrentSliceIndices(): [number, number, number] {
    return this.currentSliceIndices;
  }

  /**
   * Update a specific slider's slice index.
   * @param sliderIndex - 0 for Aufschnitte, 1 for Seitenansichten, 2 for Querschnitte
   * @param index - The new index value
   */
  async updateSliceAtIndex(
    sliderIndex: 0 | 1 | 2,
    index: number,
  ): Promise<void> {
    this.currentSliceIndices[sliderIndex] = index;

    // Get all three slice numbers
    const ranges = this.getSliceRanges();
    const sliceNumbers: number[] = [];

    for (let i = 0; i < 3; i++) {
      const range = ranges[i];
      const localIndex = this.currentSliceIndices[i];
      const globalIndex = range.start + localIndex;

      if (
        globalIndex >= 0 &&
        globalIndex < this.availableSlices.length &&
        globalIndex >= range.start &&
        globalIndex <= range.end
      ) {
        sliceNumbers.push(this.availableSlices[globalIndex]);
      }
    }

    await this.updateSlices(sliceNumbers);
  }

  /**
   * Check if this layer supports slice selection.
   */
  get supportsSliceSelection(): boolean {
    return this.layer.source.type === 'Ogc' && this.availableSlices.length > 0;
  }

  zoomIntoView(): void {
    this.viewer.flyTo(this.tileset).then();
  }

  moveToTop(): void {
    this.viewer.scene.primitives.raiseToTop(this.tileset);
  }

  /**
   * Update the displayed slices for OGC tileset sources.
   * @param sliceNumbers - Array of slice numbers to display (e.g., [227, 245, 348])
   */
  async updateSlices(sliceNumbers: number[]): Promise<void> {
    if (this.layer.source.type !== 'Ogc') {
      console.warn('updateSlices is only supported for OGC sources');
      return;
    }

    if (!this.originalTilesetJson || !this.baseUrl) {
      console.error('Original tileset JSON or base URL not available');
      return;
    }

    // If already updating, store this as pending update and return
    if (this.isUpdatingSlices) {
      this.pendingSliceUpdate = sliceNumbers;
      return;
    }

    // Mark as updating
    this.isUpdatingSlices = true;

    try {
      await this.performSliceUpdate(sliceNumbers);

      // Check if there's a pending update
      while (this.pendingSliceUpdate !== null) {
        const nextSlices = this.pendingSliceUpdate;
        this.pendingSliceUpdate = null;
        await this.performSliceUpdate(nextSlices);
      }
    } finally {
      // Always clear the updating flag
      this.isUpdatingSlices = false;
    }
  }

  /**
   * Perform the actual slice update.
   */
  private async performSliceUpdate(sliceNumbers: number[]): Promise<void> {
    // Create pruned tileset with new slices
    const keepSlices = new Set(sliceNumbers);
    const prunedTileset = makePrunedTileset(
      this.originalTilesetJson,
      keepSlices,
      this.baseUrl,
    );
    const tilesetUrl = toBlobUrl(prunedTileset);

    // Store current state
    const currentOpacity = this.layer.opacity;
    const currentVisibility = this.layer.isVisible;
    const currentIndex = this.findIndexInPrimitives(this.tileset);

    // Properly remove old tileset
    if (this.tileset) {
      this.viewer.scene.primitives.remove(this.tileset);

      if (!this.tileset.isDestroyed()) {
        this.tileset.destroy();
      }
    }

    // Release old blob URL
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }

    // Store new blob URL
    this.currentBlobUrl = tilesetUrl;

    // Create new tileset with updated slices
    const tileset = await Cesium3DTileset.fromUrl(tilesetUrl, {
      show: currentVisibility,
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

    // Add at the same position as before
    if (currentIndex !== null) {
      this.viewer.scene.primitives.add(tileset, currentIndex);
    } else {
      this.viewer.scene.primitives.add(tileset);
    }

    this._tileset = tileset;

    // Restore opacity if it was different from 1
    if (currentOpacity !== 1) {
      tileset.customShader?.setUniform('u_alpha', currentOpacity);
    }

    // Release old picking lock
    if (this.scenePickingLock) {
      this.scenePickingLock.release();
      this.scenePickingLock = null;
    }

    // Set up load progress tracking
    const pickService = PickService.get();
    this.scenePickingLock = pickService.acquireScenePickingLock();
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

  /**
   * Extract all available slice numbers from the tileset JSON.
   */
  private extractAvailableSlices(tilesetJson: any): number[] {
    const slices: number[] = [];

    const traverse = (tile: any): void => {
      const uri = tile?.content?.uri;
      if (uri) {
        const slice = parseSlice(uri);
        if (slice !== null) {
          slices.push(slice);
        }
      }
      if (tile?.children?.length) {
        tile.children.forEach(traverse);
      }
    };

    if (tilesetJson?.root) {
      traverse(tilesetJson.root);
    }

    return slices.sort((a, b) => a - b);
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
    let tilesetUrl: string;

    if (this.layer.source.type === 'Ogc') {
      const token = import.meta.env['VITE_OGC_GST_BASIC_AUTH'];
      const originalFetch = Resource.prototype.fetch;
      Resource.prototype.fetch = function (options) {
        this.headers = {
          ...(this.headers || {}),
          Authorization: `Basic ${token}`,
        };
        return originalFetch.call(this, options);
      };
      // For OGC sources, fetch the tileset JSON, prune it, and create a blob URL
      const tilesetJson = await resource.fetchJson();
      this.originalTilesetJson = tilesetJson;
      this.baseUrl = resource.url;

      // Extract all available slices
      this.availableSlices = this.extractAvailableSlices(tilesetJson);

      // Initialize the three sliders to their middle positions
      const ranges = this.getSliceRanges();
      this.currentSliceIndices = [
        Math.floor((ranges[0].end - ranges[0].start) / 2), // Middle of Aufschnitte
        Math.floor((ranges[1].end - ranges[1].start) / 2), // Middle of Seitenansichten
        Math.floor((ranges[2].end - ranges[2].start) / 2), // Middle of Querschnitte
      ];

      // Start with the three middle slices
      const initialSlices = [
        this.availableSlices[ranges[0].start + this.currentSliceIndices[0]],
        this.availableSlices[ranges[1].start + this.currentSliceIndices[1]],
        this.availableSlices[ranges[2].start + this.currentSliceIndices[2]],
      ].filter((s) => s !== undefined);

      const keepSlices = new Set(initialSlices);
      const prunedTileset = makePrunedTileset(
        tilesetJson,
        keepSlices,
        resource.url,
      );
      tilesetUrl = toBlobUrl(prunedTileset);
      this.currentBlobUrl = tilesetUrl;
    } else {
      // For other sources, use the resource URL directly
      tilesetUrl = resource.url;
    }

    const tileset = await Cesium3DTileset.fromUrl(tilesetUrl, {
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

    // Release blob URL if it exists
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }

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

function parseSlice(uri: string): number | null {
  const m = /-slice-(\d+)\.glb$/.exec(uri);
  return m ? Number(m[1]) : null;
}

function makePrunedTileset(
  original: any,
  keepSlices: Set<number>,
  baseUrl: string,
): any {
  const clone = structuredClone(original);

  const prune = (tile: any): any | null => {
    let keep = false;

    const uri = tile?.content?.uri;
    if (uri) {
      const slice = parseSlice(uri);
      if (slice !== null && keepSlices.has(slice)) {
        keep = true;
        // Convert relative URI to absolute URI
        tile.content.uri = new URL(uri, baseUrl).href;
      }
    }

    if (tile?.children?.length) {
      const keptChildren = tile.children
        .map(prune)
        .filter((x: any) => x !== null);

      tile.children = keptChildren;
      if (keptChildren.length > 0) keep = true;
    }

    return keep ? tile : null;
  };

  const newRoot = prune(clone.root);
  if (!newRoot) {
    throw new Error('None of the selected slices were found in the tileset.');
  }

  clone.root = newRoot;

  // IMPORTANT: keep original geometricError values
  // This is crucial for Cesium to traverse the tree

  return clone;
}

function toBlobUrl(json: any): string {
  const blob = new Blob([JSON.stringify(json)], { type: 'application/json' });
  return URL.createObjectURL(blob);
}
