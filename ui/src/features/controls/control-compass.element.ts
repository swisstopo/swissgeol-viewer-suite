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
import { CesiumService } from 'src/services/cesium.service';
import { getCameraView } from 'src/permalink';

@customElement('control-compass')
export class ControlCompass extends CoreElement {
  @consume({ context: CesiumService.context() })
  accessor cesiumService!: CesiumService;

  private viewer: Viewer | null = null;
  private compassBody: HTMLElement | null = null;
  private removePostRenderListener: (() => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.role = 'button';
    this.addEventListener('click', this.toggle);
    this.register(() => this.removeEventListener('click', this.toggle));

    this.register(() =>
      this.viewer?.camera.changed.removeEventListener(this.handleCameraChange),
    );
    this.register(() => this.removePostRenderListener?.());

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

  private applyTransform(h: number, p: number, r: number) {
    if (this.compassBody === null || !this.compassBody.isConnected) {
      this.compassBody = this.shadowRoot?.querySelector(
        '.ngm-compass-body',
      ) as HTMLElement | null;
    }

    if (this.compassBody === null) {
      return;
    }

    // The compass glyph is a flat SVG; rotateX quickly collapses it into a thin
    // edge where the bottom (gray) half visually dominates. Model pitch as a
    // vertical squash to keep both halves readable.
    const pitchScale = Math.max(
      0.25,
      Math.abs(Math.sin(CesiumMath.toRadians(p))),
    );

    this.compassBody.style.transform = `
      rotateZ(${-h}deg)
      scaleY(${pitchScale})
      rotateZ(${r}deg)
    `;
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
      <ngm-core-icon icon="compass"></ngm-core-icon>
    </div>
  `;

  static readonly styles = css`
    :host {
      display: flex;
      justify-content: center;
      align-items: center;

      perspective: 600px;
      transform-style: preserve-3d;
    }

    .ngm-compass-body {
      display: flex;
      justify-content: center;
      align-items: center;
      transform-style: preserve-3d;
      transform-origin: 50% 50%;
      will-change: transform;
    }

    ngm-core-icon {
      transform-box: fill-box;
      transform-origin: 50% 50%;
    }
  `;
}
