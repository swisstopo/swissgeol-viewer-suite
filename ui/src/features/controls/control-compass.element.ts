import { CoreElement } from 'src/features/core';
import { customElement } from 'lit/decorators.js';
import { css, html } from 'lit';
import { consume } from '@lit/context';
import { viewerContext } from 'src/context';
import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  HeadingPitchRange,
  Math as CesiumMath,
  Viewer,
} from 'cesium';

@customElement('control-compass')
export class ControlCompass extends CoreElement {
  @consume({ context: viewerContext })
  accessor viewer!: Viewer;

  connectedCallback(): void {
    super.connectedCallback();
    this.role = 'button';
    this.addEventListener('click', this.toggle);

    this.viewer.camera.changed.addEventListener(this.handleCameraChange);
    this.register(() =>
      this.viewer.camera.changed.removeEventListener(this.handleCameraChange),
    );
  }

  protected firstUpdated() {
    this.handleCameraChange();
  }

  private readonly handleCameraChange = () => {
    const { heading, pitch, roll } = this.viewer.camera;
    const h = CesiumMath.toDegrees(heading);
    const p = CesiumMath.toDegrees(pitch);
    const r = CesiumMath.toDegrees(roll);
    const target = this.shadowRoot?.children[0] as HTMLElement | undefined;
    if (target !== undefined) {
      target.style.transform = `
        rotateZ(${-h}deg)
        rotateX(${90 + p}deg)
        rotateZ(${r}deg)
      `;
    }
  };

  private readonly toggle = () => {
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

  readonly render = () => html`<ngm-core-icon icon="compass"></ngm-core-icon>`;

  static readonly styles = css`
    :host {
      display: flex;
      justify-content: center;
      align-items: center;

      perspective: 600px;
      transform-style: preserve-3d;
    }

    ngm-core-icon {
      transform-box: fill-box;
      transform-origin: 50% 50%;
    }
  `;
}
