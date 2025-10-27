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

  constructor() {
    super();
    MainStore.viewer.subscribe((viewer) => {
      this.viewer = viewer;
    });
  }

  pick(position: Cartesian2): Cartesian3 | null {
    if (this.viewer === null) {
      return null;
    }

    // Determine the position of the click on the globe via a ray cast onto the WGS ellipsoid.
    // This method works even with the globe turned off, unlike `scene.pickPosition`.
    // It also doesn't trigger any weird errors happening around picking while specific tiles aren't fully loaded yet.
    const ray = this.viewer.camera.getPickRay(position);
    if (ray === undefined) {
      return null;
    }
    const interval = IntersectionTests.rayEllipsoid(ray, Ellipsoid.WGS84);
    return Ray.getPoint(ray, interval.start);
  }
}
