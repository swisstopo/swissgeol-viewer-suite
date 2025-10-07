import { Viewer } from 'cesium';
import { Layer } from 'src/features/layer';

export abstract class LayerController<T extends Layer = Layer> {
  private readonly watches: Array<unknown>;
  private currentWatchIndex = 0;
  private hasChanged = false;

  private isInitialized = false;

  constructor(
    readonly layer: T,
    protected readonly viewer: Viewer,
  ) {
    this.register();
    this.isInitialized = true;
  }

  protected abstract addToViewer();

  protected abstract removeFromViewer(): void;

  protected abstract register();

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
        action(value);
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

  protected update(layer: T) {}
}
