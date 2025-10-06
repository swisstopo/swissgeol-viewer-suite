import { Viewer } from 'cesium';
import { Layer } from 'src/features/layer';

export abstract class LayerController<T extends Layer = Layer> {
  constructor(
    readonly layer: T,
    protected readonly viewer: Viewer,
  ) {}

  protected abstract addToViewer();
}
