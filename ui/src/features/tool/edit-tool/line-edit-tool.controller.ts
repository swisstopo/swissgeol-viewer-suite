import { EditAnchor, EditAnchorType, EditToolController } from 'src/features/tool/edit-tool/edit-tool.controller';
import { BehaviorSubject, Observable } from 'rxjs';
import { asId, Id } from 'src/models/id.model';
import { Cartesian3 } from 'cesium';

export class LineEditToolController implements EditToolController {
  private readonly _anchors$: BehaviorSubject<EditAnchor[]>;

  constructor(nodes: Cartesian3[]) {
    const anchors: EditAnchor[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const nextNode = nodes[(i + 1) % nodes.length];
      anchors.push({
        id: asId(crypto.randomUUID()),
        type: EditAnchorType.Node,
        coordinate: node,
      });
      anchors.push({
        id: asId(crypto.randomUUID()),
        type: EditAnchorType.Edge,
        coordinate: calculateEdge(node, nextNode),
      });
    }
    this._anchors$ = new BehaviorSubject(anchors);
  }

  get anchors$(): Observable<EditAnchor[]> {
    return this._anchors$.asObservable();
  }

  handleAnchorDrag(id: Id<EditAnchor>, position: Cartesian3) {
    const anchors = [...this._anchors$.value];
    const i = anchors.findIndex((it) => it.id === id);
    if (i < 0) {
      throw new Error(`unknown anchor: ${id}`);
    }
    const anchor = anchors[i];

    const prevIndex = (i - 1) % anchors.length;
    const nextIndex = (i + 1) % anchors.length;
    const prevAnchor = anchors[prevIndex];
    const nextAnchor = anchors[nextIndex];

    switch (anchor.type) {
      case EditAnchorType.Node: {
        const prevNodeIndex = (i - 2) % anchors.length;
        const nextNodeIndex = (i + 2) % anchors.length;
        const prevNode = anchors[prevNodeIndex];
        const nextNode = anchors[nextNodeIndex];
        anchors[i] = {
          ...anchor,
          coordinate: position,
        };
        anchors[prevIndex] = {
          ...prevAnchor,
          coordinate: calculateEdge(position, prevNode.coordinate),
        };
        anchors[nextIndex] = {
          ...nextAnchor,
          coordinate: calculateEdge(position, nextNode.coordinate),
        };
        break;
      }
      case EditAnchorType.Edge: {
        anchors[i] = {
          ...anchor,
          type: EditAnchorType.Node,
          coordinate: position,
        };

        // Splice moves any existing element to the right,
        // so adding an element before the current anchor must use the current anchor's position.
        anchors.splice(i, 0, {
          id: asId(crypto.randomUUID()),
          type: EditAnchorType.Edge,
          coordinate: calculateEdge(position, prevAnchor.coordinate),
        });
        anchors.splice(nextIndex, 0, {
          id: asId(crypto.randomUUID()),
          type: EditAnchorType.Edge,
          coordinate: calculateEdge(position, nextAnchor.coordinate),
        });
        break;
      }
    }
    this._anchors$.next(anchors);
  }
}

const calculateEdge = (a: Cartesian3, b: Cartesian3): Cartesian3 => {
  const edge = new Cartesian3();
  Cartesian3.lerp(a, b, 0.5, edge);
  return edge;
};
