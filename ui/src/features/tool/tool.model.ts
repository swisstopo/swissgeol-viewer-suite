import { Cartesian3 } from 'cesium';
import { Id } from 'src/models/id.model';

export enum ToolType {
  Draw = 'Draw',
  Edit = 'Edit',
}

export interface Feature {
  /**
   * The feature's unique id.
   * */
  id: Id<this>;

  /**
   * The feature's name.
   * */
  name: FeatureName;

  /**
   * The geometry that represents this feature.
   */
  geometry: Geometry;
}

export type FeatureName = string | CopiedFeatureName | GeneratedFeatureName;

export interface CopiedFeatureName {
  baseId: Id<Feature>;
}

export interface GeneratedFeatureName {
  /**
   * The number of the feature, unique in combination with it geometry's shape.
   *
   * This is only used for naming.
   */
  number: number;
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

export interface EditTool extends BaseTool {
  type: ToolType.Edit;
  featureId: Id<Feature>;
}

export type Tool = DrawTool | EditTool;

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
