import { Cartesian3 } from 'cesium';
import { Geometry } from 'src/features/tool/tool.model';
import { Observable } from 'rxjs';

/**
 * A `DrawController` represents the state of a shape that is currently being drawn.
 * It is made up of a collection of coordinates, and determines how these coordinates are drawn.
 */
export interface DrawController {
  /**
   * The geometry created by the controller's coordinates.
   *
   * If no coordinates are known, then this observable should be empty.
   *
   * While drawing, the output of this observable may continuously change.
   * However, the controller is responsible for ensuring that the geometry's `id` remains
   * the same across all versions.
   *
   * After calling {@link DrawController.destroy}, this observable has to complete.
   */
  readonly geometry$: Observable<Geometry>;

  /**
   * Whether the shape is complete.
   *
   * If this is `false`, then the shape will not be extended anymore.
   * A click with a complete shape will lead to geometry being saved.
   */
  readonly isComplete: boolean;

  /**
   * Handles a click at a specific coordinate.
   * This should add the coordinate to the controller's shape.
   *
   * If your shape is complete and should not be extended anymore,
   * set {@link DrawController.isComplete} to `true`.
   *
   * @param position The coordinate that has been clicked.
   */
  handleClick(position: Cartesian3): void;

  /**
   * Handles the mouse being moved.
   * If possible, this should move the active coordinate to the mouse position.
   *
   * @param position The position to which the mouse has been moved.
   */
  handleMouseMove(position: Cartesian3): void;

  /**
   * Frees any resources associated with this controller.
   * Completes the {@link DrawController.geometry$ geometry's observable}.
   */
  destroy(): void;
}
