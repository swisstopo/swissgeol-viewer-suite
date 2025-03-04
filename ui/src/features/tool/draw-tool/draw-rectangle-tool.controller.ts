import { Cartesian3 } from 'cesium';
import { DrawController } from 'src/features/tool/draw-tool/draw-tool.controller';
import { Geometry, RectangleCoordinates, Shape } from 'src/features/tool/tool.model';
import { Observable, Subject } from 'rxjs';
import { asId } from 'src/models/id.model';
import { rectanglify } from 'src/draw/helpers';

export class DrawRectangleToolController implements DrawController {
  private readonly id = asId(crypto.randomUUID());
  private readonly _geometry$ = new Subject<Geometry>();

  private coordinates: [Cartesian3] | [Cartesian3, Cartesian3] | [Cartesian3, Cartesian3, Cartesian3] = [
    Cartesian3.ZERO,
  ];

  get geometry$(): Observable<Geometry> {
    return this._geometry$.asObservable();
  }

  get isComplete(): boolean {
    return this.coordinates.length === 3;
  }

  handleClick(position: Cartesian3): void {
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
    this.coordinates[this.coordinates.length - 1] = position;
    this.draw();
  }

  destroy(): void {
    this._geometry$.complete();
  }

  private draw(): void {
    switch (this.coordinates.length) {
      case 1:
        this._geometry$.next({
          id: this.id,
          shape: Shape.Point,
          coordinate: this.coordinates[0],
        });
        break;
      case 2:
        this._geometry$.next({
          id: this.id,
          shape: Shape.Line,
          coordinates: this.coordinates,
        });
        break;
      case 3:
        this._geometry$.next({
          id: this.id,
          shape: Shape.Rectangle,
          coordinates: rectanglify(this.coordinates) as RectangleCoordinates,
        });
        break;
    }
  }
}
