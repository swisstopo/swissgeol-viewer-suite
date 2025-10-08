import { Viewer } from 'cesium';
import { Layer } from 'src/features/layer';

/**
 * A {@link LayerController} is responsible for managing how a {@link Layer} is displayed on the {@link Viewer}.
 *
 * A controller instance will be created when a layer is added to the viewer,
 * and will be discarded once the layer is removed.
 *
 * This is an abstract base class.
 * Instance types are chosen based on the {@link BaseLayer.type type} of the layer that should be displayed.
 *
 * ### Lifecycle
 * #### Lifecycle - Creation
 * A new instance is created via the constructor:
 * ```ts
 * const myController = new MyLayerController(theLayerInstance, theViewer)
 * ```
 * This adds the layer to the viewer and displays it with the layer's default settings.
 *
 *
 * #### Lifecycle - Update
 * Changes to the layer are propagated the controller via `update`:
 * ```ts
 * myController.update(theUpdatedLayerInstance)
 * ```
 * This reacts to changes on the layer and applies them to the viewer.
 * Depending on the severity of the changes, one of following things will happen:
 *
 * 1. The viewer stays as-is - nothing happens.
 * 2. The current Cesium layer is adjusted.
 * 3. The current Cesium layer is replaced with a new one.
 * 4. The current Cesium layer is (temporarily) removed from the viewer.
 *
 * Which of these is applied fully depends on the exact controller type.
 *
 *
 * #### Lifecyle - Removal
 * To remove the layer from the viewer, simply call `remove`:
 * ```ts
 * myController.remove()
 * ```
 * Note that the controller instance should not be used afterward.
 *
 *
 * ## Implementation
 * Specific controller implementations need to provide the following aspects:
 * Creation and replacement, adjustment and removal.
 *
 * ### Creation and Replacement
 * To create the controller's data and initialize it, {@link LayerController.addToViewer} has to be implemented.
 * This method will be called once from inside the layer's controller,
 * and once whenever a {@link LayerController.watch watched value} requested a reinitialization.
 * Note that you should never implement behavior in your own controller, but instead use this method for all initialization.
 *
 * ### Adjustment
 * To react to changes, {@link LayerController.reactToChanges} has to be implemented.
 * Inside this method, you can register value watchers using {@link LayerController.watch}.
 * Watched values can either adjust the existing Cesium layer, or request a reinitialization.
 *
 * ### Removal
 * To allow removal, {@link LayerController.removeFromViewer} has to be implemented.
 * This method should remove all owned data from the viewer, and fully free any other resources.
 */
export abstract class LayerController<T extends Layer = Layer> {
  /**
   * All watched values, in the order in which they were registered.
   *
   * Note that this array contains only the most recent set of values.
   * It is used to compare changes between two consecutive versions of the same layer.
   *
   * @private
   */
  private readonly watchedValues: unknown[] = [];

  /**
   * The index within {@link watchedValues} that the next call to {@link watch} references.
   * This should only be updated while {@link reactToChanges} is being run,
   * and is `0` otherwise.
   *
   * @private
   */
  private currentWatchIndex = 0;

  /**
   * A set of actions that should be applied in order to sync the Cesium layer with the actual layer data.
   * These changes should all be applied exactly once after {@link reactToChanges} has been executed.
   *
   * @private
   */
  private requestedChanges: Array<() => void> = [];

  /**
   * Whether the most recent call to {@link reactToChanges} has requested for a reinitialization.
   * After reinitialization, this should be reset to `false`.
   *
   * @private
   */
  private hasRequestedReinitialization = false;

  /**
   * Whether the first, initial Cesium layer has been created yet.
   * @private
   */
  private isInitialized = false;

  /**
   * The current layer data.
   *
   * @private
   */
  private _layer: T;

  constructor(
    /**
     * The layer's initial data.
     */
    layer: T,

    /**
     * The viewer instance.
     */
    protected readonly viewer: Viewer,
  ) {
    this._layer = layer;
    this.reactToChanges();
    this.isInitialized = true;
    this.currentWatchIndex = 0;

    this.addToViewer();
  }

  /**
   * The layer data currently displayed by the controller.
   */
  get layer(): T {
    return this._layer;
  }

  /**
   * Updates the controller's current layer data,
   * adjusting the Cesium viewer where needed.
   *
   * @param layer The updated layer data.
   */
  update(layer: T): void {
    // Update the local layer data.
    // Note that we do this *before* checking for changes, as change detection is handled via `watchedValues`.
    this._layer = layer;

    // Check if there are any changes between the current and the new dataset.
    this.reactToChanges();

    // If the changes require the current Cesium layer to be removed and a new one to be added,
    // we have to re-run `addToViewer`.
    if (this.hasRequestedReinitialization) {
      this.addToViewer();
    }
    this.hasRequestedReinitialization = false;

    // Apply any adjustments to the current layer.
    // Note that we do this even if we have reinitialized the layer,
    // as there may be adjustments that are not handled by `addToViewer` itself.
    for (const change of this.requestedChanges) {
      change();
    }

    // Reset the temporary watch fields.
    this.currentWatchIndex = 0;
    this.requestedChanges = [];
  }

  /**
   * Remove the layer from the viewer and destroy the controller's owned data.
   */
  remove(): void {
    this.removeFromViewer();
  }

  /**
   * Zooms the viewer to the layer's location.
   */
  abstract zoomIntoView(): void;

  /**
   * Checks if the Cesium layer needs to be adjusted based on the current layer data.
   *
   * Note that this method should mostly consist of calls to {@link watch},
   * with no conditional or other side effects.
   *
   * @protected
   */
  protected abstract reactToChanges(): void;

  /**
   * Adds the layer to the viewer.
   * If the layer has already been added, this instead replaces the current Cesium layer with a new one.
   *
   * @protected
   */
  protected abstract addToViewer(): void;

  /**
   * Removes the Cesium layer from the viewer, fully destroying it in the process.
   *
   * @protected
   */
  protected abstract removeFromViewer(): void;

  /**
   * Compares a value to its previous version.
   *
   * If the value has changed, `action` will be called.
   * If `action` doesn't exist, a reinitializaton is requested instead.
   *
   * Note that when a value is checked for the first time (i.e. there is no preceding version),
   * this is essentially a no-op, called only to register the value for later comparison.
   *
   * @param value The update value.
   * @param action An action to execute when the value has changed. This is assumed to adjust the Cesium layer.
   * @protected
   */
  protected watch<T>(value: T, action?: (value: T) => void): void {
    if (!this.isInitialized) {
      this.watchedValues.push(value);
    }
    const lastValue = this.watchedValues[this.currentWatchIndex];
    this.watchedValues[this.currentWatchIndex] = value;
    this.currentWatchIndex += 1;

    if (this.haveValuesChanged(value, lastValue)) {
      if (action === undefined) {
        this.hasRequestedReinitialization = true;
      } else {
        this.requestedChanges.push(() => action(value));
      }
    }
  }

  /**
   * Checks whether two versions of a value have any differences between them.
   *
   * This is *not* deep equality, but simple identity checks with support for array iteration.
   *
   * @param a The first value.
   * @param b The second value.
   * @return Whether the two values have changed, i.e. are not identical.
   * @private
   */
  private haveValuesChanged(a: unknown, b: unknown): boolean {
    if (a === b) {
      return false;
    }
    if (!(Array.isArray(a) && Array.isArray(b)) || a.length === b.length) {
      return true;
    }
    for (let i = 0; i < a.length; i++) {
      const aElement = a[i];
      const bElement = b[i];
      if (this.haveValuesChanged(aElement, bElement)) {
        return true;
      }
    }
    return false;
  }
}
