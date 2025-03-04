import { DrawStyleController } from 'src/features/tool/draw-style/draw-style.controller';
import {
  Geometry,
  LineGeometry,
  PointGeometry,
  PolygonGeometry,
  RectangleGeometry,
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
  public makeEntity(geometry: Geometry): Entity {
    switch (geometry.shape) {
      case Shape.Point: {
        const entity = this.makePointEntity(geometry);
        this.updatePoint(entity, geometry);
        return entity;
      }
      case Shape.Line: {
        const entity = this.makeLineEntity(geometry);
        this.updateLine(entity, geometry);
        return entity;
      }
      case Shape.Polygon: {
        const entity = this.makePolygonEntity(geometry);
        this.updateArea(entity, geometry);
        return entity;
      }
      case Shape.Rectangle: {
        const entity = this.makeRectangleEntity(geometry);
        this.updateArea(entity, geometry);
        return entity;
      }
    }
  }

  public updateEntity(entity: Entity, geometry: Geometry): Entity {
    const properties = entity.properties;
    if (properties === undefined) {
      return this.makeEntity(geometry);
    }
    const style = properties.drawStyle?.getValue(JulianDate.now()) ?? null;
    if (style !== this.constructor) {
      return this.makeEntity(geometry);
    }

    const entityType = (properties.type?.getValue(JulianDate.now()) ?? null) as Shape | null;
    if (entityType !== geometry.shape) {
      return this.makeEntity(geometry);
    }
    switch (geometry.shape) {
      case Shape.Point:
        this.updatePoint(entity, geometry);
        break;
      case Shape.Line:
        this.updateLine(entity, geometry);
        break;
      case Shape.Polygon:
      case Shape.Rectangle:
        this.updateArea(entity, geometry);
        break;
    }
    return entity;
  }

  protected updatePoint(entity: Entity, geometry: PointGeometry): void {
    (entity.position as ConstantPositionProperty).setValue(geometry.coordinate);
  }

  protected updateLine(entity: Entity, geometry: LineGeometry): void {
    (entity.properties!.coordinates as ConstantProperty).setValue(geometry.coordinates);
  }

  protected updateArea(entity: Entity, geometry: PolygonGeometry | RectangleGeometry): void {
    (entity.properties!.coordinates as ConstantProperty).setValue(this.mapAreaCoordinates(geometry.coordinates));
  }

  protected abstract makePointEntity(geometry: PointGeometry): Entity;
  protected abstract makeLineEntity(geometry: LineGeometry): Entity;
  protected abstract makePolygonEntity(geometry: PolygonGeometry): Entity;
  protected abstract makeRectangleEntity(geometry: RectangleGeometry): Entity;

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
