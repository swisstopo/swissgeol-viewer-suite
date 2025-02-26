import { Cartesian3 } from 'cesium';
import { Drawing } from 'src/features/tool/tool.model';
import { Observable } from 'rxjs';

export interface DrawController {
  readonly drawing$: Observable<Drawing>;

  readonly isComplete: boolean;

  handleClick(position: Cartesian3): void;

  handleMouseMove(position: Cartesian3): void;

  destroy(): void;
}
