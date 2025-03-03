import {
  CallbackProperty,
  Cartesian3,
  ClassificationType,
  Color,
  CornerType,
  Entity,
  HeightReference,
  JulianDate,
  VerticalOrigin,
} from 'cesium';
import { BaseDrawStyleController } from 'src/features/tool/draw-style/base-draw-style.controller';
import { LineDrawing, PinDrawing, PointDrawing, PolygonDrawing, RectangleDrawing, Shape } from '../tool.model';
import { POINT_SYMBOLS } from 'src/constants';

const SKETCH_COLOR = Color.fromBytes(0, 153, 255, 191);

export class SketchDrawStyleController extends BaseDrawStyleController {
  protected makePointEntity(drawing: PointDrawing): Entity {
    return new Entity({
      id: `${drawing.id}`,
      position: drawing.coordinate,
      properties: {
        type: Shape.Point,
        drawStyle: this.constructor,
      },
      point: {
        color: SKETCH_COLOR,
        outlineWidth: 1,
        outlineColor: Color.BLACK,
        pixelSize: 5,
        disableDepthTestDistance: 0,
        heightReference: HeightReference.CLAMP_TO_GROUND,
      },
    });
  }

  protected makePinEntity(drawing: PinDrawing): Entity {
    return new Entity({
      id: `${drawing.id}`,
      position: drawing.coordinate,
      properties: {
        type: Shape.Pin,
        drawStyle: this.constructor,
      },
      billboard: {
        image: `/images/${POINT_SYMBOLS[0]}`,
        color: SKETCH_COLOR,
        scale: 0.5,
        verticalOrigin: VerticalOrigin.BOTTOM,
        disableDepthTestDistance: 0,
        heightReference: HeightReference.CLAMP_TO_GROUND,
      },
    });
  }

  protected makeLineEntity(drawing: LineDrawing): Entity {
    const material = SKETCH_COLOR;
    const newEntity = new Entity({
      id: `${drawing.id}`,
      properties: {
        type: Shape.Line,
        drawStyle: this.constructor,
        coordinates: drawing.coordinates,
      },
      polyline: {
        positions: new CallbackProperty(() => newEntity.properties!.coordinates!.getValue(JulianDate.now()), false),
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
    const material = SKETCH_COLOR;
    const newEntity = new Entity({
      id: `${drawing.id}`,
      properties: {
        type: Shape.Polygon,
        drawStyle: this.constructor,
        coordinates: drawing.coordinates,
      },
      polyline: {
        positions: new CallbackProperty(() => newEntity.properties!.coordinates!.getValue(JulianDate.now()), false),
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

  protected makeRectangleEntity(drawing: RectangleDrawing): Entity {
    const material = SKETCH_COLOR;
    const newEntity = new Entity({
      id: `${drawing.id}`,
      properties: {
        type: Shape.Rectangle,
        drawStyle: this.constructor,
        coordinates: drawing.coordinates,
      },
      polyline: {
        positions: new CallbackProperty(() => newEntity.properties!.coordinates!.getValue(JulianDate.now()), false),
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

  protected readonly mapAreaCoordinates = (coordinates: Cartesian3[]) => [...coordinates, coordinates[0]];
}
