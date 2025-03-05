import { Cartesian3 } from 'cesium';
import { Observable, Subject } from 'rxjs';
import { EditAnchor, EditAnchorType, EditToolController } from 'src/features/tool/edit-tool/edit-tool.controller';
import { asId, Id } from 'src/models/id.model';
import { Array4, RectangleGeometry } from 'src/features/tool/tool.model';

export class RectangleEditToolController implements EditToolController {
  anchors: Array4<EditAnchor>;

  private readonly _anchorChanged$ = new Subject<EditAnchor>();

  anchorChanged$: Observable<EditAnchor> = this._anchorChanged$.asObservable();

  constructor(geometry: RectangleGeometry) {
    this.anchors = geometry.coordinates.map((coordinate) => ({
      id: asId(crypto.randomUUID()),
      type: EditAnchorType.Node,
      coordinate,
    })) as Array4<EditAnchor>;
  }

  handleAnchorDrag(id: Id<EditAnchor>, position: Cartesian3): void {
    const i = this.anchors.findIndex((it) => it.id === id);
    if (i < 0) {
      throw new Error(`unknown anchor: ${id}`);
    }

    const dIndex = (i + 3) % 4;
    const bIndex = (i + 1) % 4;

    // The rectangle, before the drag, is made up of the following components (counter-clockwise):
    // a :: the point that is being moved.
    // b :: the point after (to the right) of `a`.
    // c :: the point opposite of `a`, which does not move.
    // d :: the point before (to the left) of `a`.
    //
    // The drag is represented by the following values:
    // a2 :: the point to which `a` should be moved.
    // s  :: the vector from `a` to `a2`.
    //
    // The drag does the following:
    // - `a` is moved to `a2`
    // - `b` is moved by the vector `sb`, created from projecting `s` onto the line `ad`.
    // - `d` is moved by the vector `sd`, created from projecting `s` onto the line `ab`.
    // Note that `ab` and `ad` are lines, not vectors, as `s` may point in any possible direction.

    const a = this.anchors[i].coordinate;
    const b = this.anchors[bIndex].coordinate;
    const d = this.anchors[dIndex].coordinate;
    const a2 = position;

    // Compute `s`.
    const s = Cartesian3.subtract(a2, a, new Cartesian3());

    // Compute the line `ab`.
    const ab = Cartesian3.subtract(b, a, new Cartesian3());
    Cartesian3.normalize(ab, ab);

    // Project `s` onto `ab` to get `sd`
    const dotProduct = Cartesian3.dot(s, ab);
    const sd = Cartesian3.multiplyByScalar(ab, dotProduct, new Cartesian3());

    // Compute `sd`.
    const sb = Cartesian3.subtract(s, sd, new Cartesian3());

    // Compute the new values for `d` and `b`.
    const d2 = Cartesian3.add(d, sd, new Cartesian3());
    const b2 = Cartesian3.add(b, sb, new Cartesian3());

    this.anchors[i].coordinate = position;
    this.anchors[dIndex].coordinate = d2;
    this.anchors[bIndex].coordinate = b2;

    this._anchorChanged$.next(this.anchors[i]);
    this._anchorChanged$.next(this.anchors[dIndex]);
    this._anchorChanged$.next(this.anchors[bIndex]);
  }
}
