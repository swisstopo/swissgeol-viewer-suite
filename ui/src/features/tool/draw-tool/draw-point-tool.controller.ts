import { Cartesian3 } from 'cesium';
import { DrawController } from 'src/features/tool/draw-tool/draw-tool.controller';
import { PointGeometry, Shape } from 'src/features/tool/tool.model';
import { Observable, Subject } from 'rxjs';
import { asId } from 'src/models/id.model';

export class DrawPointToolController implements DrawController {
  private readonly id = asId(crypto.randomUUID());
  private readonly _geometry$ = new Subject<PointGeometry>();

  readonly isComplete = true;

  get geometry$(): Observable<PointGeometry> {
    return this._geometry$.asObservable();
  }

  handleClick(position: Cartesian3): void {
    this.draw(position);
  }

  handleMouseMove(position: Cartesian3): void {
    this.draw(position);
  }

  destroy(): void {
    this._geometry$.complete();
  }

  private draw(position: Cartesian3): void {
    this._geometry$.next({
      id: this.id,
      shape: Shape.Point,
      coordinate: position,
    });
  }
}
