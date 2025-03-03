import { Cartesian3 } from 'cesium';
import { DrawController } from 'src/features/tool/draw-tool/draw-tool.controller';
import { PinDrawing, Shape } from 'src/features/tool/tool.model';
import { Observable, Subject } from 'rxjs';
import { asId } from 'src/models/id.model';

export class DrawPointToolController implements DrawController {
  private readonly id = asId(crypto.randomUUID());
  private readonly _drawing$ = new Subject<PinDrawing>();

  readonly isComplete = true;

  get drawing$(): Observable<PinDrawing> {
    return this._drawing$.asObservable();
  }

  handleClick(position: Cartesian3): void {
    this.draw(position);
  }

  handleMouseMove(position: Cartesian3): void {
    this.draw(position);
  }

  destroy(): void {
    this._drawing$.complete();
  }

  private draw(position: Cartesian3): void {
    this._drawing$.next({
      id: this.id,
      shape: Shape.Pin,
      coordinate: position,
    });
  }
}
