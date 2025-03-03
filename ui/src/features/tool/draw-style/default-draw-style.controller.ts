import { ClassificationType, Color, CornerType, Entity, HeightReference, VerticalOrigin } from 'cesium';
import { BaseDrawStyleController } from 'src/features/tool/draw-style/base-draw-style.controller';
import { LineDrawing, PinDrawing, PointDrawing, PolygonDrawing, RectangleDrawing, Shape } from '../tool.model';
import { POINT_SYMBOLS } from 'src/constants';

const COLOR = Color.BLUE;
const AREA_COLOR = COLOR.withAlpha(0.3);

export class DefaultDrawStyleController extends BaseDrawStyleController {
  protected makePointEntity(drawing: PointDrawing): Entity {
    return new Entity({
      id: `${drawing.id}`,
      position: drawing.coordinate,
      show: true,
      properties: {
        type: Shape.Pin,
        drawStyle: this.constructor,
      },
      point: {
        color: COLOR,
        outlineWidth: 1,
        outlineColor: Color.BLACK,
        pixelSize: 5,
        heightReference: HeightReference.RELATIVE_TO_TERRAIN,
      },
    });
  }

  protected makePinEntity(drawing: PinDrawing): Entity {
    return new Entity({
      id: `${drawing.id}`,
      position: drawing.coordinate,
      show: true,
      properties: {
        type: Shape.Pin,
        drawStyle: this.constructor,
      },
      billboard: {
        show: true,
        image: `/images/${POINT_SYMBOLS[0]}`,
        color: COLOR,
        scale: 0.5,
        verticalOrigin: VerticalOrigin.BOTTOM,
        disableDepthTestDistance: 0,
        heightReference: HeightReference.RELATIVE_TO_TERRAIN,
      },
    });
  }

  protected makeLineEntity(drawing: LineDrawing): Entity {
    const material = COLOR;
    const newEntity = new Entity({
      id: `${drawing.id}`,
      properties: {
        type: Shape.Line,
        drawStyle: this.constructor,
        coordinates: drawing.coordinates,
      },
      polyline: {
        positions: this.makePositionsProperty(() => newEntity),
        material,
        clampToGround: true,
        width: 4,
        classificationType: ClassificationType.TERRAIN,
      },
      polylineVolume: {
        cornerType: CornerType.MITERED,
        outline: true,
        outlineColor: material,
        material: material,
      },
    });
    return newEntity;
  }

  protected makePolygonEntity(drawing: PolygonDrawing): Entity {
    const material = AREA_COLOR;
    const newEntity = new Entity({
      id: `${drawing.id}`,
      properties: {
        type: Shape.Polygon,
        drawStyle: this.constructor,
        coordinates: drawing.coordinates,
      },
      polygon: {
        hierarchy: this.makeHierarchyProperty(() => newEntity),
        material,
        classificationType: ClassificationType.TERRAIN,
      },
      polylineVolume: {
        cornerType: CornerType.MITERED,
        outline: true,
        outlineColor: material,
        material: material,
      },
    });
    return newEntity;
  }

  protected makeRectangleEntity(drawing: RectangleDrawing): Entity {
    const material = AREA_COLOR;
    const newEntity = new Entity({
      id: `${drawing.id}`,
      properties: {
        type: Shape.Rectangle,
        drawStyle: this.constructor,
        coordinates: drawing.coordinates,
      },
      polygon: {
        hierarchy: this.makeHierarchyProperty(() => newEntity),
        material,
        classificationType: ClassificationType.TERRAIN,
      },
      polylineVolume: {
        cornerType: CornerType.MITERED,
        outline: true,
        outlineColor: material,
        material: material,
      },
    });
    return newEntity;
  }
}
