import {
  CameraEventType,
  Cartesian3,
  defined,
  KeyboardEventModifier,
  Matrix4,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Transforms,
  Viewer,
} from 'cesium';

export class OrbitController {
  private viewer: Viewer;
  private handler: ScreenSpaceEventHandler;
  private pivot: Cartesian3 | null = null;
  private orbiting = false;
  private hasTransformed = false;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    this.handler = new ScreenSpaceEventHandler(viewer.canvas);

    this.handler.setInputAction(
      (movement) => {
        if (!movement.position) return;

        const picked = viewer.scene.pickPosition(movement.position);
        if (!defined(picked)) return;

        const cam = viewer.camera;
        const toENU = Transforms.eastNorthUpToFixedFrame(picked);
        const invENU = Matrix4.inverseTransformation(toENU, new Matrix4());

        this.pivot = picked;
        this.orbiting = true;
        this.hasTransformed = false;
        viewer.scene.screenSpaceCameraController.rotateEventTypes = [
          CameraEventType.LEFT_DRAG,
          {
            eventType: CameraEventType.LEFT_DRAG,
            modifier: KeyboardEventModifier.CTRL,
          },
        ];
      },
      ScreenSpaceEventType.LEFT_DOWN,
      KeyboardEventModifier.CTRL,
    );

    this.handler.setInputAction(
      () => {
        if (!this.orbiting || !this.pivot) return;

        if (!this.hasTransformed) {
          const transform = Transforms.eastNorthUpToFixedFrame(this.pivot);
          this.viewer.camera.lookAtTransform(transform);
          this.hasTransformed = true;
        }

        viewer.scene.camera.setView({
          orientation: {
            heading: viewer.scene.camera.heading,
            pitch: viewer.scene.camera.pitch,
            roll: 0,
          },
        });
      },
      ScreenSpaceEventType.MOUSE_MOVE,
      KeyboardEventModifier.CTRL,
    );

    const stop = () => {
      this.viewer.camera.lookAtTransform(Matrix4.IDENTITY);
      this.orbiting = false;
      this.pivot = null;
      this.hasTransformed = false;

      viewer.scene.screenSpaceCameraController.enableRotate = true;
    };

    this.handler.setInputAction(stop, ScreenSpaceEventType.LEFT_UP);
    this.handler.setInputAction(
      stop,
      ScreenSpaceEventType.LEFT_UP,
      KeyboardEventModifier.CTRL,
    );
  }

  destroy(): void {
    this.handler.destroy();
  }
}
