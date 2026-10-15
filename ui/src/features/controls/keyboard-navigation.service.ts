import { BaseService } from 'src/services/base.service';
import { CesiumService } from 'src/services/cesium.service';
import {
  Cartesian3,
  Cartesian4,
  Event,
  Matrix4,
  Scene,
  Transforms,
  Viewer,
} from 'cesium';
import { firstValueFrom, Observable, Subject } from 'rxjs';
import NavToolsStore from 'src/store/navTools';

const DEFAULT_CAMERA_SPEED = 800.0;
const MIN_CAMERA_SPEED = DEFAULT_CAMERA_SPEED * 0.25;
const MAX_CAMERA_SPEED = 2000.0;
// One step moves the speed by this fraction of the range between min and max.
const SPEED_STEP_FRACTION = 0.05;
const SPRINT_FACTOR = 3.0;

interface MovementFlags {
  moveForward: boolean;
  moveBackward: boolean;
  moveUp: boolean;
  moveDown: boolean;
  moveLeft: boolean;
  moveRight: boolean;
  lookUp: boolean;
  lookDown: boolean;
  lookLeft: boolean;
  lookRight: boolean;
}

/**
 * Keyboard-based camera navigation using WASD/QE keys (plus arrow keys,
 * PageUp/PageDown, C, comma/period for speed, Shift to sprint, Esc to stop).
 * Uses ENU (East-North-Up) frame for vertical movement so "up" always means
 * away from the globe surface regardless of camera orientation.
 *
 * Speed is adjustable via Shift+scroll wheel.
 */
export class KeyboardNavigationService extends BaseService {
  private scene!: Scene;
  private canvas: HTMLCanvasElement | undefined;
  private cameraSpeed = DEFAULT_CAMERA_SPEED;
  private isSprinting = false;
  private readonly speedChangeSubject = new Subject<number>();
  private unlistenPostRender: Event.RemoveCallback | null = null;

  private readonly flags: MovementFlags = {
    moveForward: false,
    moveBackward: false,
    moveUp: false,
    moveDown: false,
    moveLeft: false,
    moveRight: false,
    lookUp: false,
    lookDown: false,
    lookLeft: false,
    lookRight: false,
  };

  private readonly rotateSpeed = Math.PI / 400;

  private readonly keyDownHandler = this.onKeyDown.bind(this);
  private readonly keyUpHandler = this.onKeyUp.bind(this);
  private readonly blurHandler = this.resetFlags.bind(this);
  private readonly wheelHandler = this.onWheel.bind(this);

  constructor() {
    super();

    BaseService.onReady(() => void this.setup());
  }

  private async setup(): Promise<void> {
    const cesiumService = await CesiumService.inject();
    const viewer = await firstValueFrom(cesiumService.viewer$);
    this.initialize(viewer);
  }

  get speed(): number {
    return this.cameraSpeed;
  }

  set speed(value: number) {
    this.cameraSpeed = clamp(value, MIN_CAMERA_SPEED, MAX_CAMERA_SPEED);
    this.speedChangeSubject.next(this.cameraSpeed);
  }

  /** Emits the new speed whenever it is changed. */
  get speedChange$(): Observable<number> {
    return this.speedChangeSubject.asObservable();
  }

  /** The current speed relative to the default speed. */
  get speedFactor(): number {
    return this.cameraSpeed / DEFAULT_CAMERA_SPEED;
  }

  get minSpeed(): number {
    return MIN_CAMERA_SPEED;
  }

  get maxSpeed(): number {
    return MAX_CAMERA_SPEED;
  }

  private initialize(viewer: Viewer): void {
    this.scene = viewer.scene;

    const canvas = this.scene.canvas;
    this.canvas = canvas;
    canvas.setAttribute('tabindex', '0');
    canvas.onclick = () => canvas.focus();

    document.addEventListener('keydown', this.keyDownHandler);
    document.addEventListener('keyup', this.keyUpHandler);
    window.addEventListener('blur', this.blurHandler);
    canvas.addEventListener('wheel', this.wheelHandler, {
      passive: false,
      capture: true,
    });

    this.unlistenPostRender = this.scene.postRender.addEventListener(() =>
      this.onPostRender(),
    );
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!isTargetNavigable(event.target as HTMLElement)) {
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      return;
    }

    this.isSprinting = event.shiftKey;

    if (event.key === 'Escape') {
      this.resetFlags();
      return;
    }

    const key = event.key.toLowerCase();
    if (key === ',' || key === '.') {
      this.changeSpeed(key === '.' ? 1 : -1);
      event.preventDefault();
      return;
    }

    if (isArrowOrPageKey(key) && isTextualInput(event.target as HTMLElement)) {
      return;
    }

    const flag = getFlagForKey(key);
    if (flag !== undefined) {
      this.flags[flag] = true;
      NavToolsStore.hideTargetPoint();
      event.preventDefault();
      this.scene.requestRender();
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    this.isSprinting = event.shiftKey;
    const flag = getFlagForKey(event.key.toLowerCase());
    if (flag !== undefined) {
      this.flags[flag] = false;
    }
  }

  private changeSpeed(direction: number): void {
    this.speed =
      this.cameraSpeed +
      direction * SPEED_STEP_FRACTION * (MAX_CAMERA_SPEED - MIN_CAMERA_SPEED);
  }

  private resetFlags(): void {
    this.isSprinting = false;
    for (const key of Object.keys(this.flags) as (keyof MovementFlags)[]) {
      this.flags[key] = false;
    }
  }

  private onWheel(event: WheelEvent): void {
    if (!event.shiftKey) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const direction = Math.sign(event.deltaY);
    if (direction === 0) {
      return;
    }
    this.changeSpeed(-direction);
  }

  private hasActiveMovement(): boolean {
    return Object.values(this.flags).some(Boolean);
  }

  private onPostRender(): void {
    if (!this.hasActiveMovement()) {
      return;
    }

    const camera = this.scene.camera;
    const height = Math.abs(camera.positionCartographic.height);

    // Lateral movement (AD): sqrt scaling for gentle curve at high altitude
    const lateralFactor = Math.max(Math.sqrt(height / 500), 1);
    const speed = this.cameraSpeed * (this.isSprinting ? SPRINT_FACTOR : 1);
    const lateralStep = (speed / 80) * lateralFactor;

    // Forward/backward (WS) and vertical (QE): linear scaling — faster far out, slower near surface
    const zoomFactor = Math.max(height / 500, 1);
    const zoomStep = (speed / 80) * zoomFactor;

    // Compute ENU up/down vectors at current camera position
    const enuTransform = Transforms.eastNorthUpToFixedFrame(camera.positionWC);
    const upCol = Matrix4.getColumn(enuTransform, 2, scratchCartesian4);
    const globalUp = Cartesian3.fromElements(
      upCol.x,
      upCol.y,
      upCol.z,
      scratchUp,
    );
    const globalDown = Cartesian3.fromElements(
      -upCol.x,
      -upCol.y,
      -upCol.z,
      scratchDown,
    );

    if (this.flags.moveForward) camera.moveForward(zoomStep);
    if (this.flags.moveBackward) camera.moveBackward(zoomStep);
    if (this.flags.moveUp) camera.move(globalUp, zoomStep);
    if (this.flags.moveDown) camera.move(globalDown, zoomStep);
    if (this.flags.moveLeft) camera.moveLeft(lateralStep);
    if (this.flags.moveRight) camera.moveRight(lateralStep);

    // Look rotation
    const rotateStep = this.rotateSpeed;
    let hasRotation = false;
    let heading = camera.heading;
    let pitch = camera.pitch;

    if (this.flags.lookLeft) {
      heading -= rotateStep;
      hasRotation = true;
    }
    if (this.flags.lookRight) {
      heading += rotateStep;
      hasRotation = true;
    }
    if (this.flags.lookUp) {
      pitch += rotateStep;
      hasRotation = true;
    }
    if (this.flags.lookDown) {
      pitch -= rotateStep;
      hasRotation = true;
    }
    if (hasRotation) {
      camera.setView({ orientation: { heading, pitch } });
    }

    this.scene.requestRender();
  }

  destroy(): void {
    document.removeEventListener('keydown', this.keyDownHandler);
    document.removeEventListener('keyup', this.keyUpHandler);
    window.removeEventListener('blur', this.blurHandler);
    if (this.canvas) {
      this.canvas.removeEventListener('wheel', this.wheelHandler, {
        capture: true,
      } as EventListenerOptions);
      this.canvas.onclick = null;
      this.canvas = undefined;
    }
    if (this.unlistenPostRender) {
      this.unlistenPostRender();
    }
  }
}

const scratchCartesian4 = new Cartesian4();
const scratchUp = new Cartesian3();
const scratchDown = new Cartesian3();

function getFlagForKey(key: string): keyof MovementFlags | undefined {
  switch (key) {
    case 'w':
      return 'moveForward';
    case 's':
      return 'moveBackward';
    case 'q':
    case ' ':
    case '+':
    case 'pageup':
      return 'moveUp';
    case 'e':
    case 'c':
    case '-':
    case 'pagedown':
      return 'moveDown';
    case 'a':
      return 'moveLeft';
    case 'd':
      return 'moveRight';
    case 'i':
    case 'arrowup':
      return 'lookUp';
    case 'k':
    case 'arrowdown':
      return 'lookDown';
    case 'j':
    case 'arrowleft':
      return 'lookLeft';
    case 'l':
    case 'arrowright':
      return 'lookRight';
    default:
      return undefined;
  }
}

function isArrowOrPageKey(key: string): boolean {
  return key.startsWith('arrow') || key.startsWith('page');
}

function isTextualInput(target: HTMLElement): boolean {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function isTargetNavigable(target: HTMLElement): boolean {
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    const type = (target as HTMLInputElement).type;
    return type === 'checkbox' || type === 'range';
  }
  return !target.isContentEditable;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
