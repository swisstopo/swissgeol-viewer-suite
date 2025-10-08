import { Viewer } from 'cesium';
import { Layer } from 'src/features/layer';

export abstract class LayerController<T extends Layer = Layer> {
  private readonly watches: unknown[] = [];
  private requestedChanges: Array<() => void> = [];

  private currentWatchIndex = 0;
  private hasChanged = false;

  private isInitialized = false;

  private _layer: T;

  constructor(
    layer: T,
    protected readonly viewer: Viewer,
  ) {
    this._layer = layer;
    this.register();
    this.isInitialized = true;
    this.currentWatchIndex = 0;

    this.addToViewer();
  }

  get layer(): T {
    return this._layer;
  }

  update(layer: T): void {
    this._layer = layer;
    this.register();
    if (this.hasChanged) {
      this.addToViewer();
    }
    for (const change of this.requestedChanges) {
      change();
    }
    this.hasChanged = false;
    this.currentWatchIndex = 0;
    this.requestedChanges = [];
  }

  remove(): void {
    this.removeFromViewer();
  }

  abstract zoomIntoView(): void;

  protected abstract register(): void;

  protected abstract addToViewer(): void;

  protected abstract removeFromViewer(): void;

  protected watch<T>(value: T, action?: (value: T) => void): void {
    if (!this.isInitialized) {
      this.watches.push(value);
    }
    const lastValue = this.watches[this.currentWatchIndex];
    this.watches[this.currentWatchIndex] = value;
    this.currentWatchIndex += 1;

    if (this.haveValuesChanged(value, lastValue)) {
      if (action === undefined) {
        this.hasChanged = true;
      } else {
        this.requestedChanges.push(() => action(value));
      }
    }
  }

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
