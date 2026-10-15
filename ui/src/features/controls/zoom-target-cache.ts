import { Cartesian2, Cartesian3, Scene } from 'cesium';
import { pickPositionWithRay } from 'src/cesiumutils';
import type { PickWorldPosition } from 'src/features/controls/approach-limited-zoom.controller';

const scratchCanvasPosition = new Cartesian2();
const scratchTerrain = new Cartesian3();

export interface ZoomTargetCacheOptions {
  /**
   * How much frame time, in seconds, a picked target may be reused for.
   *
   * This is counted in the frame durations the zoom's approach limiter is
   * evaluated over, rather than in wall-clock time, because it is meant to bound
   * how far the camera can approach a stale target. The limiter caps each frame
   * at 0.1 s, so this also works at low frame rates, where a single frame can
   * take far longer than this.
   */
  readonly maximumAge?: number;

  /**
   * How far, in CSS pixels, the target may have drifted away from the zoom
   * origin and still be reused.
   */
  readonly pixelTolerance?: number;

  /**
   * How far the terrain under the zoom origin may have moved and the target
   * still be reused, as a fraction of the terrain's distance from the camera.
   */
  readonly terrainTolerance?: number;
}

/**
 * Reuses a recently picked zoom target instead of picking it on every frame.
 *
 * The zoom controller resolves its target on every frame of a zoom and of the
 * glide that follows it. The depth-buffer pick it uses is expensive: every
 * `Scene.pickPosition` re-renders depth and forces a synchronous GPU read-back.
 *
 * Zooming moves the camera along the line towards the target, so as long as
 * nothing else moves the camera or the pointer, the target stays under the zoom
 * origin and a new pick would return that same point. A target is therefore
 * reused as long as all of the following hold, and picked again otherwise:
 *
 * - it has been reused for no more than {@link maximumAge} of frame time. With
 *   the zoom's default approach rate of 3/s, 0.1 s lets the camera close at
 *   most 26 % of the distance to a stale target. This bounds the effect of
 *   geometry that loads in front of the target in the meantime;
 * - it still projects onto the zoom origin, so the pointer has not moved and
 *   the camera has not been panned, tilted or flown elsewhere;
 * - the terrain along the pointer ray is where it was when the target was
 *   picked, so terrain refinement cannot raise the surface in front of a stale
 *   target. The terrain ray is cheap: it intersects the rendered terrain on the
 *   CPU and does not touch the GPU.
 *
 * Misses are not cached, so a ray that hits nothing is picked again on the next
 * frame.
 */
export class ZoomTargetCache {
  readonly maximumAge: number;
  readonly pixelTolerance: number;
  readonly terrainTolerance: number;

  /** Number of targets that were picked, for the debug HUD. */
  pickCount = 0;

  /** Number of targets that were reused, for the debug HUD. */
  reuseCount = 0;

  private readonly target = new Cartesian3();
  private readonly terrain = new Cartesian3();
  private hasTarget = false;
  private hasTerrain = false;
  private age = 0;

  constructor(options: ZoomTargetCacheOptions = {}) {
    this.maximumAge = options.maximumAge ?? 0.1;
    this.pixelTolerance = options.pixelTolerance ?? 0.5;
    this.terrainTolerance = options.terrainTolerance ?? 0.01;
  }

  /**
   * Resolves the target under `windowPosition` for a frame lasting
   * `frameSeconds`: the cached one while it is still valid, otherwise a new one
   * from `pick`.
   */
  resolve(
    scene: Scene,
    windowPosition: Cartesian2,
    result: Cartesian3,
    pick: PickWorldPosition,
    frameSeconds: number,
  ): Cartesian3 | undefined {
    const terrain = pickPositionWithRay(scene, windowPosition, scratchTerrain);
    if (this.isReusable(scene, windowPosition, terrain, frameSeconds)) {
      this.age += frameSeconds;
      this.reuseCount++;
      return Cartesian3.clone(this.target, result);
    }

    this.pickCount++;
    const target = pick(scene, windowPosition, result);
    this.hasTarget = target !== undefined;
    if (target !== undefined) {
      Cartesian3.clone(target, this.target);
      this.hasTerrain = terrain !== undefined;
      if (terrain !== undefined) {
        Cartesian3.clone(terrain, this.terrain);
      }
      this.age = 0;
    }
    return target;
  }

  /** Discards the cached target, so the next call picks again. */
  clear(): void {
    this.hasTarget = false;
  }

  private isReusable(
    scene: Scene,
    windowPosition: Cartesian2,
    terrain: Cartesian3 | undefined,
    frameSeconds: number,
  ): boolean {
    if (!this.hasTarget || this.age + frameSeconds > this.maximumAge) {
      return false;
    }

    // Undefined if the target is behind the camera.
    const position = scene.cartesianToCanvasCoordinates(
      this.target,
      scratchCanvasPosition,
    );
    if (
      position === undefined ||
      Cartesian2.distance(position, windowPosition) > this.pixelTolerance
    ) {
      return false;
    }

    if (terrain === undefined || !this.hasTerrain) {
      return terrain === undefined && !this.hasTerrain;
    }
    const tolerance =
      this.terrainTolerance *
      Cartesian3.distance(scene.camera.positionWC, this.terrain);
    return Cartesian3.distance(terrain, this.terrain) <= tolerance;
  }
}
