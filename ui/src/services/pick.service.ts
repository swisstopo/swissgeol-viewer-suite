import {
  Cartesian2,
  Cartesian3,
  Ellipsoid,
  IntersectionTests,
  Ray,
  Viewer,
} from 'cesium';
import { BaseService } from 'src/utils/base.service';
import MainStore from 'src/store/main';

export class PickService extends BaseService {
  private viewer: Viewer | null = null;

  private disableCount = 0;

  constructor() {
    super();
    MainStore.viewer.subscribe((viewer) => {
      this.viewer = viewer;
    });
  }

  /**
   * Find the position on the map that is displayed at a specific window coordinate.
   *
   * @param windowPosition The position on the window.
   * @return the corresponding world position.
   */
  pick(windowPosition: Cartesian2): Cartesian3 | null {
    if (this.viewer === null) {
      return null;
    }
    if (
      this.disableCount === 0 &&
      this.viewer.scene.pickPositionSupported &&
      this.viewer.scene.globe.show
    ) {
      return this.tryPickWithSceneOrFallback(windowPosition);
    } else {
      return this.pickWithMath(windowPosition);
    }
  }

  private pickWithScene(position: Cartesian2): Cartesian3 | null {
    return this.viewer!.scene.pickPosition(position) ?? null;
  }

  private tryPickWithSceneOrFallback(position: Cartesian2): Cartesian3 | null {
    try {
      return this.pickWithScene(Cartesian2.clone(position));
    } catch (e) {
      if (!String(e).startsWith('DeveloperError: This object was destroyed,')) {
        throw e;
      }
      return this.pickWithMath(position);
    }
  }

  private pickWithMath(position: Cartesian2): Cartesian3 | null {
    // Determine the position of the click on the globe via a ray cast onto the WGS ellipsoid.
    // This method works even with the globe turned off, unlike `scene.pickPosition`.
    // It also doesn't trigger any weird errors happening around picking while specific tiles aren't fully loaded yet.
    // However, it may not be as accurate as `scene.pickPosition`,
    // especially in regard to specific positions on elevated or sunken terrain.
    const ray = this.viewer!.camera.getPickRay(position);
    if (ray === undefined) {
      return null;
    }
    const interval = IntersectionTests.rayEllipsoid(ray, Ellipsoid.WGS84);
    if (interval === undefined) {
      return null;
    }
    return Ray.getPoint(ray, interval.start);
  }

  /**
   * Acquire a {@link ScenePickingLock} that, while active, disables the use of `Scene.pickPosition`.
   * This is useful as that method can cause unrecoverable render issues when called
   * while some layers, tiles or other primitives are not yet fully loaded.
   *
   * Note that it's the responsibility of the caller to fully release the lock.
   * When not explicitly releasing a lock, `Scene.pickPosition` will remain unused,
   * possibly leading to inaccurate pick behavior.
   */
  acquireScenePickingLock(): ScenePickingLock {
    this.disableCount += 1;
    let isActive = true;
    return {
      release: (): void => {
        if (isActive) {
          this.disableCount = Math.max(0, this.disableCount - 1);
          isActive = false;
        }
      },
    };
  }
}

/**
 * A lock that, while active, disables accurate picking using the Cesium scene.
 *
 * It is the callers responsibility to ensure that locks are released before they are destroyed.
 *
 * Note that multiple locks can exist at the same time, without influencing each other.
 * Releasing a lock while another remains will leave pick behavior locked.
 */
export interface ScenePickingLock {
  /**
   * Releases the lock, allowing `Scene.pickPosition` to be used.
   *
   * This method may be called multiple times without consequences.
   */
  release(): void;
}
