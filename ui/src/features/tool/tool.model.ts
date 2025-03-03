import { Cartesian3 } from 'cesium';
import { Id } from 'src/models/id.model';

export enum ToolType {
  Draw = 'Draw',
}

/**
 * The possible shapes that {@link BaseDrawing drawings} can take.
 */
export enum Shape {
  Pin = 'pin',
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
  variant: DrawToolVariant;
}

/**
 * The shapes that can be created and edited via the draw tool.
 *
 * Note that these loosely correspond to {@link Shape}.
 * However, not every shape can be drawn via tool.
 * Also, the representation of a {@link DrawToolVariant} is not strictly defined,
 * i.e. which shape is used to represent a tool may change depending on the context it is used in.
 */
export enum DrawToolVariant {
  Point = 'point',
  Line = 'line',
  Rectangle = 'rectangle',
  Polygon = 'polygon',
}

export type Tool = DrawTool;

interface BaseDrawing {
  id: Id<this>;
  shape: Shape;
}

export interface PointDrawing extends BaseDrawing {
  shape: Shape.Point;
  coordinate: Cartesian3;
}

export interface PinDrawing extends BaseDrawing {
  shape: Shape.Pin;
  coordinate: Cartesian3;
}

export interface LineDrawing extends BaseDrawing {
  shape: Shape.Line;

  /**
   * The line's point, with a minimal count of two.
   */
  coordinates: Cartesian3[];
}

export interface PolygonDrawing extends BaseDrawing {
  shape: Shape.Polygon;

  /**
   * The polygon's corner coordinates, in counter-clockwise rotation.
   * The array has a minimal length of three.
   */
  coordinates: Cartesian3[];
}

export interface RectangleDrawing extends BaseDrawing {
  shape: Shape.Rectangle;

  /**
   * The rectangle's corner coordinates, in counter-clockwise rotation.
   */
  coordinates: RectangleCoordinates;
}

export type RectangleCoordinates = [Cartesian3, Cartesian3, Cartesian3, Cartesian3];

export type Drawing = PointDrawing | PinDrawing | LineDrawing | PolygonDrawing | RectangleDrawing;
