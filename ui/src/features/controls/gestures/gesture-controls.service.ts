import {
  Cartesian2,
  KeyboardEventModifier,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
} from 'cesium';
import { BaseService } from 'src/services/base.service';
import { filter, Observable, OperatorFunction, Subject } from 'rxjs';
import { CesiumService } from 'src/services/cesium.service';

export class GestureControlsService extends BaseService {
  private readonly mouseMoveSubject = new Subject<MoveGestureEvent>();
  private readonly leftMouseButtonSubject = new Subject<ButtonGestureEvent>();
  private readonly middleMouseButtonSubject = new Subject<ButtonGestureEvent>();
  private readonly rightMouseButtonSubject = new Subject<ButtonGestureEvent>();

  private readonly modifiers = new Set<GestureModifier>();

  constructor() {
    super();

    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);

    CesiumService.inject().then((cesiumService) => {
      this.subscribeToViewer(cesiumService.viewer);
    });
  }

  private subscribeToViewer(viewer: Viewer) {
    const eventHandler = new ScreenSpaceEventHandler(viewer.canvas);

    const registerAction = <T>(
      type: ScreenSpaceEventType,
      action: (event: T) => void,
    ) => {
      for (const modifier of [
        undefined,
        ...(Object.values(KeyboardEventModifier) as KeyboardEventModifier[]),
      ]) {
        eventHandler.setInputAction(
          action as ScreenSpaceEventHandler.MotionEventCallback,
          type,
          modifier,
        );
      }
    };

    registerAction(ScreenSpaceEventType.MOUSE_MOVE, this.handleMotion);

    registerAction(
      ScreenSpaceEventType.LEFT_DOWN,
      this.handleButton(this.leftMouseButtonSubject, ButtonGesture.Down),
    );
    registerAction(
      ScreenSpaceEventType.LEFT_UP,
      this.handleButton(this.leftMouseButtonSubject, ButtonGesture.Up),
    );

    registerAction(
      ScreenSpaceEventType.MIDDLE_DOWN,
      this.handleButton(this.middleMouseButtonSubject, ButtonGesture.Down),
    );
    registerAction(
      ScreenSpaceEventType.MIDDLE_UP,
      this.handleButton(this.middleMouseButtonSubject, ButtonGesture.Up),
    );

    registerAction(
      ScreenSpaceEventType.RIGHT_DOWN,
      this.handleButton(this.rightMouseButtonSubject, ButtonGesture.Down),
    );
    registerAction(
      ScreenSpaceEventType.RIGHT_UP,
      this.handleButton(this.rightMouseButtonSubject, ButtonGesture.Up),
    );

    const handleMouseModifier =
      (modifier: GestureModifier) => (event: ButtonGestureEvent) => {
        this.toggleModifier(
          modifier,
          event.gesture === ButtonGesture.Down
            ? this.modifiers.add
            : this.modifiers.delete,
        );
      };

    this.leftMouseButton$.subscribe(
      handleMouseModifier(GestureModifier.LeftMouseButton),
    );

    this.middleMouseButton$.subscribe(
      handleMouseModifier(GestureModifier.MiddleMouseButton),
    );

    this.rightMouseButton$.subscribe(
      handleMouseModifier(GestureModifier.RightMouseButton),
    );
  }

  get mouseMove$(): Observable<MoveGestureEvent> {
    return this.mouseMoveSubject.asObservable();
  }

  get leftMouseButton$(): Observable<ButtonGestureEvent> {
    return this.leftMouseButtonSubject.asObservable();
  }

  get middleMouseButton$(): Observable<ButtonGestureEvent> {
    return this.middleMouseButtonSubject.asObservable();
  }

  get rightMouseButton$(): Observable<ButtonGestureEvent> {
    return this.rightMouseButtonSubject.asObservable();
  }

  private readonly handleMotion = (
    event: ScreenSpaceEventHandler.MotionEvent,
  ): void => {
    this.mouseMoveSubject.next({
      position: event.endPosition,
      previousPosition: event.startPosition,
      modifiers: new Set(this.modifiers),
    });
  };

  private readonly handleButton =
    (subject: Subject<ButtonGestureEvent>, gesture: ButtonGesture) =>
    (event: ScreenSpaceEventHandler.PositionedEvent): void => {
      subject.next({
        gesture,
        position: event.position,
        modifiers: new Set(this.modifiers),
      });
    };

  private readonly handleKeyDown = (event: KeyboardEvent): void =>
    this.toggleModifier(getKeyboardModifier(event), this.modifiers.add);

  private readonly handleKeyUp = (event: KeyboardEvent): void =>
    this.toggleModifier(getKeyboardModifier(event), this.modifiers.delete);

  private toggleModifier(
    modifier: GestureModifier | null,
    callback: (this: Set<GestureModifier>, modifier: GestureModifier) => void,
  ) {
    if (modifier !== null) {
      callback.call(this.modifiers, modifier);
    }
  }
}

export interface GestureEvent {
  modifiers: Set<GestureModifier>;
}

export interface MoveGestureEvent extends GestureEvent {
  position: Cartesian2;
  previousPosition: Cartesian2;
}

export interface ButtonGestureEvent extends GestureEvent {
  gesture: ButtonGesture;
  position: Cartesian2;
}

export enum ButtonGesture {
  Up = 'Up',
  Down = 'Down',
}

export enum GestureModifier {
  Control = 'Control',
  Shift = 'Shift',
  Alt = 'Alt',
  LeftMouseButton = 'LeftMouseButton',
  MiddleMouseButton = 'MiddleMouseButton',
  RightMouseButton = 'RightMouseButton',
}

const getKeyboardModifier = (event: KeyboardEvent): GestureModifier | null => {
  switch (event.key) {
    case 'Control':
      return GestureModifier.Control;
    case 'Shift':
      return GestureModifier.Shift;
    case 'Alt':
      return GestureModifier.Alt;
    default:
      return null;
  }
};

export const filterByModifier = <E extends GestureEvent>(
  ...modifiers: GestureModifier[]
): OperatorFunction<E, E> =>
  filter((event) =>
    modifiers.every((modifier) => event.modifiers.has(modifier)),
  );

export const filterByButtonGesture = <E extends ButtonGestureEvent>(
  gesture: ButtonGesture,
): OperatorFunction<E, E> => filter((event) => event.gesture === gesture);
