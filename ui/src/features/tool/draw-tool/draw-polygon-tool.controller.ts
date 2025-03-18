import { Cartesian3 } from 'cesium';
import { DrawController } from 'src/features/tool/draw-tool/draw-tool.controller';
import { Drawing, Shape } from 'src/features/tool/tool.model';
import { Observable, Subject } from 'rxjs';
import { asId } from 'src/models/id.model';

export class DrawPolygonToolController implements DrawController {
  private readonly id = asId(crypto.randomUUID());
  private readonly _drawing$ = new Subject<Drawing>();

  private isFixed = false;
  private readonly coordinates: Cartesian3[] = [Cartesian3.ZERO];

  readonly isComplete = false;

  get drawing$(): Observable<Drawing> {
    return this._drawing$.asObservable();
  }

  handleClick(position: Cartesian3): void {
    this.isFixed = true;
    this.draw(position);
  }

  handleMouseMove(position: Cartesian3): void {
    this.draw(position);
  }

  destroy(): void {
    this._drawing$.complete();
  }

  private draw(position: Cartesian3): void {
    this.coordinates[this.coordinates.length - 1] = position;
    if (this.isFixed) {
      this.coordinates.push(position);
      this.isFixed = false;
    }

    if (this.coordinates.length === 1) {
      this._drawing$.next({
        id: this.id,
        shape: Shape.Point,
        coordinate: this.coordinates[0],
      });
    } else if (this.coordinates.length === 2) {
      this._drawing$.next({
        id: this.id,
        shape: Shape.Line,
        coordinates: this.coordinates,
      });
    } else {
      this._drawing$.next({
        id: this.id,
        shape: Shape.Polygon,
        coordinates: this.coordinates,
      });
    }
  }
}
