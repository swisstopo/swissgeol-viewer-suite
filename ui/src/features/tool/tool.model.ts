import { Cartesian3 } from 'cesium';
import { Id } from 'src/models/id.model';

export enum ToolType {
  Draw = 'Draw',
}

export interface Feature {
  /**
   * The feature's unique id.
   * */
  id: Id<this>;

  /**
   * The id of the feature that this one has been based on.
   *
   * This is mainly used for naming. There should be no functional connection to base features.
   */
  baseId: Id<this> | null;

  /**
   * The number of the feature, unique in combination with it geometry's shape.
   *
   * This is mainly used for naming.
   */
  numberPerShape: number;

  /**
   * The geometry that represents this feature.
   */
  geometry: Geometry;
}

/**
 * The possible shapes that {@link Geometry geometries} can take.
 */
export enum Shape {
  Point = 'point',
  Line = 'line',
  Polygon = 'polygon',
  Rectangle = 'rectangle',
}

interface BaseTool {
  type: ToolType;
}

export interface DrawTool extends BaseTool {
  type: ToolType.Draw;
  shape: Shape;
}

export type Tool = DrawTool;

interface BaseGeometry {
  id: Id<this>;
  shape: Shape;
}

export interface PointGeometry extends BaseGeometry {
  shape: Shape.Point;
  coordinate: Cartesian3;
}

export interface LineGeometry extends BaseGeometry {
  shape: Shape.Line;

  /**
   * The line's point, with a minimal count of two.
   */
  coordinates: Cartesian3[];
}

export interface PolygonGeometry extends BaseGeometry {
  shape: Shape.Polygon;

  /**
   * The polygon's corner coordinates, in counter-clockwise rotation.
   * The array has a minimal length of three.
   */
  coordinates: Cartesian3[];
}

export interface RectangleGeometry extends BaseGeometry {
  shape: Shape.Rectangle;

  /**
   * The rectangle's corner coordinates, in counter-clockwise rotation.
   */
  coordinates: RectangleCoordinates;
}

export type RectangleCoordinates = [Cartesian3, Cartesian3, Cartesian3, Cartesian3];

export type Geometry = PointGeometry | LineGeometry | PolygonGeometry | RectangleGeometry;
