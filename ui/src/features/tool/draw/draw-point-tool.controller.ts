import { Cartesian3, Cartographic } from 'cesium';
import { DrawController } from 'src/features/tool/draw/draw-tool.controller';
import { PointDrawing, ToolShape } from 'src/features/tool/tool.model';
import { Observable, Subject } from 'rxjs';
import { asId } from 'src/models/id.model';

export class DrawPointToolController implements DrawController {
  private readonly id = asId(crypto.randomUUID());
  private readonly _drawing$ = new Subject<PointDrawing>();

  get drawing$(): Observable<PointDrawing> {
    return this._drawing$.asObservable();
  }

  handleClick(position: Cartesian3): void {
    this.draw(position);
    this._drawing$.complete();
  }

  handleMouseMove(position: Cartesian3): void {
    this.draw(position);
  }

  destroy(): void {
    this._drawing$.complete();
  }

  private draw(position: Cartesian3): void {
    const cartographic = Cartographic.fromCartesian(position);
    cartographic.height = 500; // Some high value, so the point is above the map.
    position = Cartographic.toCartesian(cartographic);
    this._drawing$.next({
      id: this.id,
      shape: ToolShape.Point,
      coordinate: position,
    });
  }
}
