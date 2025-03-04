import { Cartesian3, ClassificationType, Color, CornerType, Entity, HeightReference } from 'cesium';
import { BaseDrawStyleController } from 'src/features/tool/draw-style/base-draw-style.controller';
import { LineGeometry, PointGeometry, PolygonGeometry, RectangleGeometry, Shape } from '../tool.model';

const SKETCH_COLOR = Color.fromBytes(0, 153, 255, 191);

export class SketchDrawStyleController extends BaseDrawStyleController {
  protected makePointEntity(geometry: PointGeometry): Entity {
    return new Entity({
      id: `${geometry.id}`,
      position: geometry.coordinate,
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

  protected makeLineEntity(geometry: LineGeometry): Entity {
    const material = SKETCH_COLOR;
    const newEntity = new Entity({
      id: `${geometry.id}`,
      properties: {
        type: Shape.Line,
        drawStyle: this.constructor,
        coordinates: geometry.coordinates,
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

  protected makePolygonEntity(geometry: PolygonGeometry): Entity {
    const material = SKETCH_COLOR;
    const newEntity = new Entity({
      id: `${geometry.id}`,
      properties: {
        type: Shape.Polygon,
        drawStyle: this.constructor,
        coordinates: geometry.coordinates,
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

  protected makeRectangleEntity(geometry: RectangleGeometry): Entity {
    const material = SKETCH_COLOR;
    const newEntity = new Entity({
      id: `${geometry.id}`,
      properties: {
        type: Shape.Rectangle,
        drawStyle: this.constructor,
        coordinates: geometry.coordinates,
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

  protected readonly mapAreaCoordinates = (coordinates: Cartesian3[]) => [...coordinates, coordinates[0]];
}
