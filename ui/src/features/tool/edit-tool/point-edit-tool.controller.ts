import { Cartesian3 } from 'cesium';
import { Subject } from 'rxjs';
import { EditAnchor, EditAnchorType, EditToolController } from 'src/features/tool/edit-tool/edit-tool.controller';
import { asId, Id } from 'src/models/id.model';

export class PointEditToolController implements EditToolController {
  readonly anchors: [EditAnchor];

  private readonly _anchorChanged$ = new Subject<EditAnchor>();

  readonly anchorChanged$ = this._anchorChanged$.asObservable();

  constructor(coordinate: Cartesian3) {
    this.anchors = [
      {
        id: asId(crypto.randomUUID()),
        type: EditAnchorType.Virtual,
        coordinate,
      },
    ];
  }

  handleAnchorDrag(id: Id<EditAnchor>, position: Cartesian3): void {
    const [anchor] = this.anchors;
    if (anchor.id !== id) {
      throw new Error(`unknown anchor: ${id}`);
    }
    this.handleGeometryDrag(position);
  }

  handleGeometryDrag(position: Cartesian3): void {
    const [anchor] = this.anchors;
    anchor.coordinate = position;
    this._anchorChanged$.next(anchor);
  }
}
