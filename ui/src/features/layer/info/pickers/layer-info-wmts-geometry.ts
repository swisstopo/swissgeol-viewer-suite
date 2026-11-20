import type { Position } from 'geojson';
import type { IdentifiedGeometry } from './layer-info-picker-for-wmts.service';

// Allow for rounding in the projected service coordinates.
const DIRECT_TOLERANCE_METRES = 0.01;

export const isDirectWmtsMatch = (distance: number): boolean =>
  distance <= DIRECT_TOLERANCE_METRES;

const distanceToPoint = (point: Position, other: Position): number =>
  Math.hypot(point[0] - other[0], point[1] - other[1]);

const distanceToSegment = (
  point: Position,
  start: Position,
  end: Position,
): number => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return distanceToPoint(point, start);
  }
  const projection =
    ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared;
  const t = Math.max(0, Math.min(1, projection));
  return Math.hypot(point[0] - start[0] - t * dx, point[1] - start[1] - t * dy);
};

const distanceToPath = (
  point: Position,
  path: Position[],
  closed = false,
): number => {
  if (path.length === 0) {
    return Infinity;
  }

  let distance = distanceToPoint(point, path[0]);
  for (let i = 1; i < path.length; i++) {
    distance = Math.min(
      distance,
      distanceToSegment(point, path[i - 1], path[i]),
    );
  }
  return closed
    ? Math.min(
        distance,
        distanceToSegment(point, path[path.length - 1], path[0]),
      )
    : distance;
};

const isInsideRing = ([x, y]: Position, ring: Position[]): boolean => {
  let isInside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < xi + ((y - yi) * (xj - xi)) / (yj - yi)) {
      isInside = !isInside;
    }
  }
  return isInside;
};

const distanceToPolygon = (point: Position, rings: Position[][]): number => {
  const [outer, ...holes] = rings;
  if (
    outer !== undefined &&
    isInsideRing(point, outer) &&
    !holes.some((hole) => isInsideRing(point, hole))
  ) {
    return 0;
  }
  // Ring edges are part of the feature, including the boundary of a hole.
  return rings.reduce(
    (distance, ring) => Math.min(distance, distanceToPath(point, ring, true)),
    Infinity,
  );
};

/**
 * Shortest distance from the sampled position to any part of a feature (LV95 metres).
 */
export const distanceToWmtsGeometry = (
  point: Position,
  geometry: IdentifiedGeometry,
): number => {
  switch (geometry.type) {
    case 'Point':
      return distanceToPoint(point, geometry.coordinates);
    case 'MultiPoint':
      return geometry.coordinates.reduce(
        (distance, other) => Math.min(distance, distanceToPoint(point, other)),
        Infinity,
      );
    case 'LineString':
      return distanceToPath(point, geometry.coordinates);
    case 'MultiLineString':
      return geometry.coordinates.reduce(
        (distance, line) => Math.min(distance, distanceToPath(point, line)),
        Infinity,
      );
    case 'Polygon':
      return distanceToPolygon(point, geometry.coordinates);
    case 'MultiPolygon':
      return geometry.coordinates.reduce(
        (distance, polygon) =>
          Math.min(distance, distanceToPolygon(point, polygon)),
        Infinity,
      );
    default:
      // GetFeatureInfo providers can return unsupported GeoJSON geometry types.
      return Infinity;
  }
};
