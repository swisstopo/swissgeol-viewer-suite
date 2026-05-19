import { CoreElement } from 'src/features/core';
import { customElement } from 'lit/decorators.js';
import { css, html } from 'lit';
import { consume } from '@lit/context';
import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  HeadingPitchRange,
  Math as CesiumMath,
  Viewer,
} from 'cesium';
import {
  AmbientLight,
  Box3,
  Group,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  DirectionalLight,
} from 'three';
import {
  GLTFLoader,
  type GLTF,
} from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CesiumService } from 'src/services/cesium.service';
import { getCameraView } from 'src/permalink';

@customElement('control-compass')
export class ControlCompass extends CoreElement {
  @consume({ context: CesiumService.context() })
  accessor cesiumService!: CesiumService;

  private viewer: Viewer | null = null;
  private removePostRenderListener: (() => void) | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private renderer: WebGLRenderer | null = null;
  private scene3d: Scene | null = null;
  private camera3d: PerspectiveCamera | null = null;
  private headingGroup: Group | null = null;
  private pitchGroup: Group | null = null;
  private rollGroup: Group | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private latestOrientation = { heading: 0, pitch: -90, roll: 0 };

  connectedCallback(): void {
    super.connectedCallback();
    this.role = 'button';
    this.addEventListener('click', this.toggle);
    this.register(() => this.removeEventListener('click', this.toggle));

    this.register(() =>
      this.viewer?.camera.changed.removeEventListener(this.handleCameraChange),
    );
    this.register(() => this.removePostRenderListener?.());
    this.register(() => this.destroyThreeScene());

    // The Cesium viewer is created asynchronously in ngm-app.
    this.register(
      this.cesiumService.viewer$.subscribe((viewer) => {
        this.removePostRenderListener?.();
        this.removePostRenderListener = null;

        if (this.viewer !== null) {
          this.viewer.camera.changed.removeEventListener(
            this.handleCameraChange,
          );
        }
        this.viewer = viewer;
        this.viewer.camera.changed.addEventListener(this.handleCameraChange);
        this.removePostRenderListener =
          this.viewer.scene.postRender.addEventListener(
            this.handleCameraChange,
          );
        this.handleCameraChange();
      }),
    );
  }

  protected firstUpdated() {
    this.initThreeScene();
    this.syncFromPermalink();
  }

  private syncFromPermalink() {
    const orientation = getCameraView().orientation;
    if (orientation == null) {
      return;
    }

    this.applyTransform(
      CesiumMath.toDegrees(orientation.heading),
      CesiumMath.toDegrees(orientation.pitch),
      CesiumMath.toDegrees(orientation.roll ?? 0),
    );
  }

  private applyTransform(heading: number, pitch: number, roll: number) {
    this.latestOrientation = { heading, pitch, roll };
    this.applyModelRotation();
    this.redrawCompass();
  }

  private initThreeScene() {
    this.canvas = this.shadowRoot?.querySelector('.ngm-compass-canvas') ?? null;
    if (this.canvas === null) {
      return;
    }

    this.scene3d = new Scene();
    this.camera3d = new PerspectiveCamera(34, 1, 0.1, 100);
    this.camera3d.position.set(0, 0, 4);

    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.scene3d.add(new AmbientLight(0xffffff, 1.1));

    const keyLight = new DirectionalLight(0xffffff, 1.1);
    keyLight.position.set(2, 3, 4);
    this.scene3d.add(keyLight);

    const fillLight = new DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-3, -2, 2);
    this.scene3d.add(fillLight);

    this.headingGroup = new Group();
    this.pitchGroup = new Group();
    this.rollGroup = new Group();
    this.headingGroup.add(this.pitchGroup);
    this.pitchGroup.add(this.rollGroup);
    this.scene3d.add(this.headingGroup);

    this.resizeObserver = new ResizeObserver(() => this.resizeRenderer());
    this.resizeObserver.observe(this);

    this.resizeRenderer();

    const loader = new GLTFLoader();
    loader.load('/images/compass.gltf', (gltf: GLTF) => {
      if (this.rollGroup === null) {
        return;
      }

      const model = gltf.scene;
      const box = new Box3().setFromObject(model);
      const center = box.getCenter(new Vector3());
      model.position.sub(center);

      // The imported GLTF is authored with a different up/forward basis.
      // Rebase once so the default top-down camera shows the top face and north up.
      model.rotation.set(-Math.PI / 2, Math.PI, Math.PI);

      const size = box.getSize(new Vector3());
      const maxSize = Math.max(size.x, size.y, size.z, 1);
      model.scale.multiplyScalar(2.4 / maxSize);

      this.rollGroup.add(model);
      this.applyModelRotation();
      this.redrawCompass();
    });
  }

  private resizeRenderer() {
    if (
      this.renderer === null ||
      this.camera3d === null ||
      this.canvas === null
    ) {
      return;
    }

    const width = Math.max(this.canvas.clientWidth, 1);
    const height = Math.max(this.canvas.clientHeight, 1);
    this.renderer.setSize(width, height, false);
    this.camera3d.aspect = width / height;
    this.camera3d.updateProjectionMatrix();
    this.redrawCompass();
  }

  private applyModelRotation() {
    if (
      this.headingGroup === null ||
      this.pitchGroup === null ||
      this.rollGroup === null
    ) {
      return;
    }

    const { heading, pitch, roll } = this.latestOrientation;
    this.headingGroup.rotation.z = -CesiumMath.toRadians(heading);
    this.pitchGroup.rotation.x = -CesiumMath.toRadians(90 + pitch);
    this.rollGroup.rotation.z = CesiumMath.toRadians(roll);
  }

  private destroyThreeScene() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    this.renderer?.dispose();
    this.renderer = null;
    this.scene3d = null;
    this.camera3d = null;
    this.canvas = null;
    this.headingGroup = null;
    this.pitchGroup = null;
    this.rollGroup = null;
  }

  private redrawCompass() {
    if (
      this.renderer === null ||
      this.scene3d === null ||
      this.camera3d === null
    ) {
      return;
    }

    this.renderer.render(this.scene3d, this.camera3d);
  }

  private readonly handleCameraChange = () => {
    if (this.viewer === null) {
      return;
    }

    const { heading, pitch, roll } = this.viewer.camera;
    this.applyTransform(
      CesiumMath.toDegrees(heading),
      CesiumMath.toDegrees(pitch),
      CesiumMath.toDegrees(roll),
    );
  };

  private readonly toggle = () => {
    if (this.viewer === null) {
      return;
    }

    const { camera, scene } = this.viewer;

    const wnd = new Cartesian2(
      this.viewer.canvas.clientWidth / 2,
      this.viewer.canvas.clientHeight / 2,
    );
    const ray = camera.getPickRay(wnd);
    if (ray == null) {
      return;
    }

    const target = scene.globe.pick(ray, scene);
    if (target == null) {
      return;
    }

    const range = Cartesian3.distance(camera.positionWC, target);
    const pitch = camera.pitch;

    camera.flyToBoundingSphere(new BoundingSphere(target, 1.0), {
      offset: new HeadingPitchRange(0, pitch, range),
      duration: 1,
    });
  };

  readonly render = () => html`
    <div class="ngm-compass-body">
      <canvas class="ngm-compass-canvas"></canvas>
    </div>
  `;

  static readonly styles = css`
    :host {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 48px;
      height: 48px;
      border-radius: 24px;
      background: #f1f3f5;
      box-shadow: 4px 4px 2px #00000029;
      color: var(--ngm-interaction);
      cursor: pointer;
    }

    :host(:hover) {
      background-color: #dee2e6;
    }

    .ngm-compass-body {
      display: flex;
      justify-content: center;
      align-items: center;
      transform-style: preserve-3d;
      transform-origin: 50% 50%;
      width: 100%;
      height: 100%;
    }

    .ngm-compass-canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
  `;
}
