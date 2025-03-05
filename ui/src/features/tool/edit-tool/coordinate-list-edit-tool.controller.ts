import { EditAnchor, EditAnchorType, EditToolController } from 'src/features/tool/edit-tool/edit-tool.controller';
import { Subject } from 'rxjs';
import { asId, Id } from 'src/models/id.model';
import { Cartesian3 } from 'cesium';

interface Options {
  /**
   * Whether the shape forms an area.
   * This determines if the first and last node are connected.
   */
  isArea: boolean;
}

export class CoordinateListEditToolController implements EditToolController {
  readonly anchors: EditAnchor[] = [];

  private readonly _anchorChanged$ = new Subject<EditAnchor>();

  readonly anchorChanged$ = this._anchorChanged$.asObservable();

  constructor(
    nodes: Cartesian3[],
    private readonly options: Options,
  ) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      this.anchors.push({
        id: asId(crypto.randomUUID()),
        type: EditAnchorType.Node,
        coordinate: node,
      });
      if (options.isArea || i < nodes.length - 1) {
        const nextNode = nodes[(i + 1) % nodes.length];
        this.anchors.push({
          id: asId(crypto.randomUUID()),
          type: EditAnchorType.Edge,
          coordinate: calculateEdge(node, nextNode),
        });
      }
    }
  }

  handleAnchorDrag(id: Id<EditAnchor>, position: Cartesian3) {
    const { anchors } = this;
    const i = anchors.findIndex((it) => it.id === id);
    if (i < 0) {
      throw new Error(`unknown anchor: ${id}`);
    }
    const anchor = anchors[i];

    const prevIndex = (((i - 1) % anchors.length) + anchors.length) % anchors.length;
    const nextIndex = (i + 1) % anchors.length;
    const prevAnchor = anchors[prevIndex];
    const nextAnchor = anchors[nextIndex];

    switch (anchor.type) {
      case EditAnchorType.Node: {
        this.updateAnchor(i, { ...anchor, coordinate: position });

        if (this.options.isArea || i < this.anchors.length - 1) {
          const nextNodeIndex = (i + 2) % anchors.length;
          const nextNode = anchors[nextNodeIndex];
          this.updateAnchor(nextIndex, { ...nextAnchor, coordinate: calculateEdge(position, nextNode.coordinate) });
        }

        if (this.options.isArea || i > 0) {
          const prevNodeIndex = (((i - 2) % anchors.length) + anchors.length) % anchors.length;
          const prevNode = anchors[prevNodeIndex];
          this.updateAnchor(prevIndex, { ...prevAnchor, coordinate: calculateEdge(position, prevNode.coordinate) });
        }
        break;
      }
      case EditAnchorType.Edge: {
        this.updateAnchor(i, {
          ...anchor,
          type: EditAnchorType.Node,
          coordinate: position,
        });

        const prevEdge: EditAnchor = {
          id: asId(crypto.randomUUID()),
          type: EditAnchorType.Edge,
          coordinate: calculateEdge(position, prevAnchor.coordinate),
        };
        const nextEdge: EditAnchor = {
          id: asId(crypto.randomUUID()),
          type: EditAnchorType.Edge,
          coordinate: calculateEdge(position, nextAnchor.coordinate),
        };

        // Add the next before the previous, so the previous index does not shift.
        anchors.splice(nextIndex, 0, nextEdge);

        // Splice moves any existing element to the right,
        // so adding an element before the current anchor must use the current anchor's position.
        anchors.splice(i, 0, prevEdge);

        this._anchorChanged$.next(prevEdge);
        this._anchorChanged$.next(nextEdge);
        break;
      }
    }
  }

  private updateAnchor(index: number, anchor: EditAnchor): void {
    this.anchors[index] = anchor;
    this._anchorChanged$.next(anchor);
  }
}

const calculateEdge = (a: Cartesian3, b: Cartesian3): Cartesian3 => {
  const edge = new Cartesian3();
  Cartesian3.lerp(a, b, 0.5, edge);
  return edge;
};
