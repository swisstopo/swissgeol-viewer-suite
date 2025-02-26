import { Cartesian3, Cartographic } from 'cesium';
import { DrawController } from 'src/features/tool/draw/draw-tool.controller';
import { Drawing, RectangleCoordinates, ToolShape } from 'src/features/tool/tool.model';
import { Observable, Subject } from 'rxjs';
import { asId } from 'src/models/id.model';
import { rectanglify } from 'src/draw/helpers';

export class DrawRectangleToolController implements DrawController {
  private readonly id = asId(crypto.randomUUID());
  private readonly _drawing$ = new Subject<Drawing>();

  private coordinates: [Cartesian3] | [Cartesian3, Cartesian3] | [Cartesian3, Cartesian3, Cartesian3] = [
    Cartesian3.ZERO,
  ];

  get drawing$(): Observable<Drawing> {
    return this._drawing$.asObservable();
  }

  get isComplete(): boolean {
    return this.coordinates.length === 3;
  }

  handleClick(position: Cartesian3): void {
    position = this.mapPosition(position);
    this.coordinates[this.coordinates.length - 1] = position;
    switch (this.coordinates.length) {
      case 2:
        // Form a rectangle.
        this.coordinates.push(position);
        break;

      case 1:
        // Form a line.
        this.coordinates.push(position);
        break;

      case 3:
        // End.
        // TODO
        break;
    }
    this.draw();
  }

  handleMouseMove(position: Cartesian3) {
    position = this.mapPosition(position);
    this.coordinates[this.coordinates.length - 1] = position;
    this.draw();
  }

  destroy(): void {
    this._drawing$.complete();
  }

  private mapPosition(position: Cartesian3): Cartesian3 {
    const cartographic = Cartographic.fromCartesian(position);
    cartographic.height = 10_000; // Some high value, so the point is above the map.
    return Cartographic.toCartesian(cartographic);
  }

  private draw(): void {
    switch (this.coordinates.length) {
      case 1:
        this._drawing$.next({
          id: this.id,
          shape: ToolShape.Point,
          coordinate: this.coordinates[0],
        });
        break;
      case 2:
        this._drawing$.next({
          id: this.id,
          shape: ToolShape.Line,
          coordinates: this.coordinates,
        });
        break;
      case 3:
        this._drawing$.next({
          id: this.id,
          shape: ToolShape.Rectangle,
          coordinates: rectanglify(this.coordinates) as RectangleCoordinates,
        });
        break;
    }
  }
}
