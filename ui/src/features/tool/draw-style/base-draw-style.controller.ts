import { DrawStyleController } from 'src/features/tool/draw-style/draw-style.controller';
import {
  Drawing,
  LineDrawing,
  PinDrawing,
  PointDrawing,
  PolygonDrawing,
  RectangleDrawing,
  Shape,
} from 'src/features/tool/tool.model';
import {
  CallbackProperty,
  Cartesian3,
  ConstantPositionProperty,
  ConstantProperty,
  Entity,
  JulianDate,
  PolygonHierarchy,
  Property,
} from 'cesium';

export abstract class BaseDrawStyleController implements DrawStyleController {
  public makeEntity(drawing: Drawing): Entity {
    switch (drawing.shape) {
      case Shape.Point: {
        const entity = this.makePointEntity(drawing);
        this.updatePoint(entity, drawing);
        return entity;
      }
      case Shape.Pin: {
        const entity = this.makePinEntity(drawing);
        this.updatePoint(entity, drawing);
        return entity;
      }
      case Shape.Line: {
        const entity = this.makeLineEntity(drawing);
        this.updateLine(entity, drawing);
        return entity;
      }
      case Shape.Polygon: {
        const entity = this.makePolygonEntity(drawing);
        this.updateArea(entity, drawing);
        return entity;
      }
      case Shape.Rectangle: {
        const entity = this.makeRectangleEntity(drawing);
        this.updateArea(entity, drawing);
        return entity;
      }
    }
  }

  public updateEntity(entity: Entity, drawing: Drawing): Entity {
    const properties = entity.properties;
    if (properties === undefined) {
      return this.makeEntity(drawing);
    }
    const style = properties.drawStyle?.getValue(JulianDate.now()) ?? null;
    if (style !== this.constructor) {
      return this.makeEntity(drawing);
    }

    const entityType = (properties.type?.getValue(JulianDate.now()) ?? null) as Shape | null;
    if (entityType !== drawing.shape) {
      return this.makeEntity(drawing);
    }
    switch (drawing.shape) {
      case Shape.Point:
      case Shape.Pin:
        this.updatePoint(entity, drawing);
        break;
      case Shape.Line:
        this.updateLine(entity, drawing);
        break;
      case Shape.Polygon:
      case Shape.Rectangle:
        this.updateArea(entity, drawing);
        break;
    }
    return entity;
  }

  protected updatePoint(entity: Entity, drawing: PointDrawing | PinDrawing): void {
    (entity.position as ConstantPositionProperty).setValue(drawing.coordinate);
  }

  protected updateLine(entity: Entity, drawing: LineDrawing): void {
    (entity.properties!.coordinates as ConstantProperty).setValue(drawing.coordinates);
  }

  protected updateArea(entity: Entity, drawing: PolygonDrawing | RectangleDrawing): void {
    (entity.properties!.coordinates as ConstantProperty).setValue(this.mapAreaCoordinates(drawing.coordinates));
  }

  protected abstract makePointEntity(drawing: PointDrawing): Entity;
  protected abstract makePinEntity(drawing: PinDrawing): Entity;
  protected abstract makeLineEntity(drawing: LineDrawing): Entity;
  protected abstract makePolygonEntity(drawing: PolygonDrawing): Entity;
  protected abstract makeRectangleEntity(drawing: RectangleDrawing): Entity;

  protected mapAreaCoordinates(coordinates: Cartesian3[]): Cartesian3[] {
    return coordinates;
  }

  protected makePositionsProperty(getEntity: () => Entity): Property {
    return new CallbackProperty(() => getEntity().properties!.coordinates!.getValue(JulianDate.now()), false);
  }

  protected makeHierarchyProperty(getEntity: () => Entity): Property {
    return new CallbackProperty(
      () => new PolygonHierarchy(getEntity().properties!.coordinates!.getValue(JulianDate.now())),
      false,
    );
  }
}
