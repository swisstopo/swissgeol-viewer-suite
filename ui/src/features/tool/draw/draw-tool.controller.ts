import { Cartesian3 } from 'cesium';
import { Drawing } from 'src/features/tool/tool.model';
import { Observable } from 'rxjs';

export interface DrawController {
  drawing$: Observable<Drawing>;

  handleClick(position: Cartesian3): void;

  handleMouseMove(position: Cartesian3): void;

  handleStop(): void;

  destroy(): void;
}
