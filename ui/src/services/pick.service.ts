import {
  Cartesian2,
  Cartesian3,
  Ellipsoid,
  IntersectionTests,
  Ray,
  Viewer,
} from 'cesium';
import { firstValueFrom } from 'rxjs';
import { BaseService } from 'src/services/base.service';
import { CesiumService } from 'src/services/cesium.service';

export class PickService extends BaseService {
  private viewer: Viewer | null = null;

  constructor() {
    super();

    CesiumService.inject()
      .then((s) => firstValueFrom(s.viewer$))
      .then((viewer) => {
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
    if (this.viewer.scene.globe.show) {
      return this.tryPickWithSceneOrFallback(windowPosition);
    } else {
      return this.pickWithMath(windowPosition);
    }
  }

  private pickWithScene(position: Cartesian2): Cartesian3 | null {
    return this.viewer!.scene.pickPosition(position) ?? null;
  }

  private tryPickWithSceneOrFallback(position: Cartesian2): Cartesian3 | null {
    const KNOWN_PICK_ERROR_SUFFIXES = [
      'DeveloperError: This object was destroyed,',
      "TypeError: Can't access property _target, v3 is undefined",
    ] as const;
    try {
      return this.pickWithScene(Cartesian2.clone(position));
    } catch (e) {
      const message = String(e);
      if (
        KNOWN_PICK_ERROR_SUFFIXES.some((suffix) => message.startsWith(suffix))
      ) {
        return this.pickWithMath(position);
      }
      throw e;
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
}
