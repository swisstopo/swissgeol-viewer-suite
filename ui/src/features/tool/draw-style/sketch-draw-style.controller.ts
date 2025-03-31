import { CallbackProperty, Cartesian3, ClassificationType, Color, CornerType, Entity, HeightReference } from 'cesium';
import { BaseDrawStyleController } from 'src/features/tool/draw-style/base-draw-style.controller';
import { LineGeometry, PointGeometry, PolygonGeometry, RectangleGeometry, Shape } from '../tool.model';
import i18next from 'i18next';
import { GeometryService } from 'src/features/tool/geometry.service';
import { asId } from 'src/models/id.model';

const SKETCH_COLOR = Color.fromBytes(0, 153, 255, 191);

export class SketchDrawStyleController extends BaseDrawStyleController {
  private readonly geometryService: GeometryService = new GeometryService();

  protected makePointEntity(geometry: PointGeometry): Entity {
    return new Entity({
      id: `${geometry.id}`,
      properties: {
        type: Shape.Point,
        drawStyle: this.constructor,
      },
      point: {
        color: SKETCH_COLOR,
        outlineWidth: 1,
        outlineColor: Color.BLACK,
        pixelSize: 5,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        heightReference: HeightReference.CLAMP_TO_GROUND,
      },
    });
  }

  protected makeLineEntity(geometry: LineGeometry): Entity {
    const material = SKETCH_COLOR;
    const newEntity = new Entity({
      id: `${geometry.id}`,
      label: this.makeLabel(
        new CallbackProperty(() => {
          const coordinates = this.getCoordinates<LineGeometry>(newEntity);
          const length = this.geometryService.getLength({
            id: asId('-'),
            shape: Shape.Line,
            coordinates,
          } satisfies LineGeometry);
          const lengthInKm = length / 1000;
          const label = i18next.t('tool.feature.attribute_names.length', { ns: 'features' });
          return `${label}: ${lengthInKm.toFixed(3)}km`;
        }, false),
      ),
      properties: {
        type: Shape.Line,
        drawStyle: this.constructor,
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
      },
      label: this.makeLabel(
        new CallbackProperty(() => {
          const [a, b, c] = this.getCoordinates<RectangleGeometry>(newEntity);
          const width = Cartesian3.distance(a, b) / 1000;
          const height = Cartesian3.distance(b, c) / 1000;
          return `${width.toFixed(3)}km x ${height.toFixed(3)}km`;
        }, false),
      ),
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
