import {
  Camera,
  CameraEventType,
  Cartesian2,
  Cartesian3,
  Ellipsoid,
  Math as CesiumMath,
  Scene,
  ScreenSpaceCameraController,
  Viewer,
} from 'cesium';
import { DEFAULT_VIEW } from 'src/constants';

/**
 * `Control2D` contains the ability to toggle the viewer in and out of the 2D mode.
 *
 * In 2D mode, the map can only be looked at top-down,
 * with any gestures that would rotate the camera into a 3D view being disabled.
 */
export class Control2dController {
  private isActive = false;

  private tiltEventTypesBackup: CameraEventType | any[] | undefined;
  private lookEventTypesBackup: CameraEventType | any[] | undefined;

  constructor(private readonly viewer: Viewer) {}

  readonly toggle = (isActive: boolean): void => {
    if (this.isActive === isActive) {
      return;
    }
    if (isActive) {
      this.activate();
    } else {
      this.deactivate();
    }
    this.isActive = isActive;
  };

  private activate(): void {
    this.toggleTerrainCollision(true);
    this.rotateCameraTo2D();
    this.disableTiltGestures();
  }

  private deactivate(): void {
    this.toggleTerrainCollision(false);
    this.enableTiltGestures();
  }

  private toggleTerrainCollision(isActive: boolean): void {
    this.cameraController.enableCollisionDetection = isActive;
  }

  private rotateCameraTo2D(): void {
    const currentHeight = this.camera.positionCartographic.height;
    if (currentHeight <= 1000) {
      this.viewer.camera.flyTo({
        duration: 2,
        ...DEFAULT_VIEW,
      });
      return;
    }

    const center = new Cartesian2(
      this.viewer.canvas.clientWidth / 2,
      this.viewer.canvas.clientHeight / 2,
    );
    const position = this.scene.pickPosition(center);
    const targetCarto = Ellipsoid.WGS84.cartesianToCartographic(position);

    const destination = Cartesian3.fromRadians(
      targetCarto.longitude,
      targetCarto.latitude,
      currentHeight,
    );

    this.viewer.camera.flyTo({
      duration: 2,
      destination,
      orientation: {
        heading: 0,
        pitch: CesiumMath.toRadians(-90),
        roll: 0,
      },
    });
  }

  private enableTiltGestures(): void {
    this.cameraController.lookEventTypes = this.lookEventTypesBackup;
    this.cameraController.tiltEventTypes = this.tiltEventTypesBackup;
  }

  private disableTiltGestures(): void {
    this.tiltEventTypesBackup = this.cameraController.tiltEventTypes;
    this.lookEventTypesBackup = this.cameraController.tiltEventTypes;
    this.cameraController.tiltEventTypes = [];
    this.cameraController.lookEventTypes = [];
  }

  private get scene(): Scene {
    return this.viewer.scene;
  }

  private get camera(): Camera {
    return this.scene.camera;
  }

  private get cameraController(): ScreenSpaceCameraController {
    return this.scene.screenSpaceCameraController;
  }
}
