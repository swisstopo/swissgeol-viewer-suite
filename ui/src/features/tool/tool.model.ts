import { Cartesian3 } from 'cesium';
import { Id } from 'src/models/id.model';

export enum ToolShape {
  Point = 'point',
  Line = 'line',
  Polygon = 'polygon',
  Rectangle = 'rectangle',
}

export enum ToolType {
  Draw = 'Draw',
}

interface BaseTool {
  type: ToolType;
}

export interface DrawTool extends BaseTool {
  type: ToolType.Draw;
  shape: ToolShape;
}

export type Tool = DrawTool;

interface BaseDrawing {
  id: Id<this>;
  shape: ToolShape;
}

export interface PointDrawing extends BaseDrawing {
  shape: ToolShape.Point;
  coordinate: Cartesian3;
}

export interface LineDrawing extends BaseDrawing {
  shape: ToolShape.Line;

  /**
   * The line's point, with a minimal count of two.
   */
  coordinates: Cartesian3[];
}

export interface PolygonDrawing extends BaseDrawing {
  shape: ToolShape.Polygon;

  /**
   * The polygon's corner coordinates, in counter-clockwise rotation.
   * The array has a minimal length of three.
   */
  coordinates: Cartesian3[];
}

export interface RectangleDrawing extends BaseDrawing {
  shape: ToolShape.Rectangle;

  /**
   * The rectangle's corner coordinates, in counter-clockwise rotation.
   */
  coordinates: RectangleCoordinates;
}

export type RectangleCoordinates = [Cartesian3, Cartesian3, Cartesian3, Cartesian3];

export type Drawing = PointDrawing | LineDrawing | PolygonDrawing | RectangleDrawing;
