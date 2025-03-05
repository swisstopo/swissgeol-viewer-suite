import { Cartesian3 } from 'cesium';
import { Id } from 'src/models/id.model';
import { Observable } from 'rxjs';

export interface EditToolController {
  readonly anchors: EditAnchor[];

  readonly anchorChanged$: Observable<EditAnchor>;

  handleAnchorDrag(id: Id<EditAnchor>, position: Cartesian3): void;

  handleGeometryDrag(position: Cartesian3): void;
}

export interface EditAnchor {
  id: Id<this>;
  coordinate: Cartesian3;
  type: EditAnchorType;
}

export enum EditAnchorType {
  Node,
  Edge,
  Virtual,
}
