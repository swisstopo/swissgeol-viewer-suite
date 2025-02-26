import { Cartesian3 } from 'cesium';
import { DrawController } from 'src/features/tool/draw/draw-tool.controller';
import { RectangleDrawing } from 'src/features/tool/tool.model';
import { Observable, Subject } from 'rxjs';

export class DrawRectangleToolController implements DrawController {
  private readonly _drawing$ = new Subject<RectangleDrawing>();

  get drawing$(): Observable<RectangleDrawing> {
    return this._drawing$.asObservable();
  }

  handleClick(_position: Cartesian3): void {
    throw new Error('not yet implemented');
  }

  handleMouseMove(_position: Cartesian3) {
    throw new Error('not yet implemented');
  }

  handleStop(): void {}

  destroy(): void {
    this._drawing$.unsubscribe();
  }
}
