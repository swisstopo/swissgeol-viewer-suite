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
  Cartesian2,
  Cartesian3,
  ConstantPositionProperty,
  ConstantProperty,
  Entity,
  HeightReference,
  HorizontalOrigin,
  JulianDate,
  LabelGraphics,
  LabelStyle,
  PolygonHierarchy,
  Property,
  VerticalOrigin,
} from 'cesium';

export abstract class BaseDrawStyleController implements DrawStyleController {
  public makeEntity(geometry: Geometry): Entity {
    switch (geometry.shape) {
      case Shape.Point: {
        const entity = this.makePointEntity(geometry);
        this.initializeEntity(entity);
        this.updatePoint(entity, geometry);
        return entity;
      }
      case Shape.Line: {
        const entity = this.makeLineEntity(geometry);
        this.initializeEntity(entity);
        this.updateLine(entity, geometry);
        return entity;
      }
      case Shape.Polygon: {
        const entity = this.makePolygonEntity(geometry);
        this.initializeEntity(entity);
        this.updateArea(entity, geometry);
        return entity;
      }
      case Shape.Rectangle: {
        const entity = this.makeRectangleEntity(geometry);
        this.initializeEntity(entity);
        this.updateArea(entity, geometry);
        return entity;
      }
    }
  }

  private initializeEntity(entity: Entity) {
    entity.position = new ConstantPositionProperty();
    entity.properties!.coordinates = new ConstantProperty();
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
    (entity.position as ConstantPositionProperty).setValue(geometry.coordinates[geometry.coordinates.length - 1]);
    (entity.properties!.coordinates as ConstantProperty).setValue(geometry.coordinates);
  }

  protected updateArea(entity: Entity, geometry: PolygonGeometry | RectangleGeometry): void {
    (entity.position as ConstantPositionProperty).setValue(geometry.coordinates[geometry.coordinates.length - 1]);
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

  protected getCoordinates<T extends Geometry & { coordinates: unknown }>(entity: Entity): T['coordinates'] {
    return (entity.properties!.coordinates as ConstantProperty).getValue(JulianDate.now());
  }

  protected makeLabel(text: Property): LabelGraphics.ConstructorOptions {
    return {
      text,
      show: new CallbackProperty(() => text.getValue(JulianDate.now()) !== null, false),
      font: '8pt arial',
      style: LabelStyle.FILL,
      showBackground: true,
      heightReference: HeightReference.CLAMP_TO_GROUND,
      verticalOrigin: VerticalOrigin.BOTTOM,
      horizontalOrigin: HorizontalOrigin.RIGHT,
      pixelOffset: new Cartesian2(-5, -5),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    };
  }
}
