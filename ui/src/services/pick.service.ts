import { Cartesian2, Cartesian3, Viewer } from 'cesium';
import { BaseService } from 'src/utils/base.service';
import { viewerContext } from 'src/context';

export class PickService extends BaseService {
  private viewer: Viewer | null = null;

  private skipCount = 0;

  constructor() {
    super();
    BaseService.inject$(viewerContext).subscribe((viewer) => {
      this.viewer = viewer;

      this.viewer?.scene.postRender.addEventListener(this.handlePostRender);
    });
  }

  pick(position: Cartesian2): Cartesian3 | null {
    if (this.viewer === null || this.skipCount !== 0) {
      return null;
    }
    return this.viewer.scene.pickPosition(position);
  }

  skipFrames(count: number): void {
    this.skipCount = Math.max(this.skipCount, count);
  }

  private readonly handlePostRender = () => {
    this.skipCount = Math.max(0, this.skipCount - 1);
  };
}
