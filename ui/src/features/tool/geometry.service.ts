import { BaseService } from 'src/utils/base.service';
import { Geometry, LineGeometry, PolygonGeometry, RectangleGeometry, Shape } from 'src/features/tool/tool.model';
import { getPolygonArea } from 'src/cesiumutils';
import { Cartesian3 } from 'cesium';

export class GeometryService extends BaseService {
  getArea(geometry: PolygonGeometry | RectangleGeometry): number;
  getArea(geometry: Geometry): number | null;
  getArea(geometry: Geometry): number | null {
    return this.compute(geometry, 'area', () => {
      switch (geometry.shape) {
        case Shape.Point:
        case Shape.Line:
          return null;
        case Shape.Polygon:
        case Shape.Rectangle:
          return getPolygonArea(geometry.coordinates);
      }
    });
  }

  getLength(geometry: LineGeometry): number;
  getLength(geometry: Geometry): number | null;
  getLength(geometry: Geometry): number | null {
    return this.compute(geometry, 'length', () => {
      switch (geometry.shape) {
        case Shape.Line: {
          let distance = 0;
          for (let i = 1; i < geometry.coordinates.length; i++) {
            const a = geometry.coordinates[i - 1];
            const b = geometry.coordinates[i];
            const lineDistance = Cartesian3.distance(a, b);
            distance += isNaN(lineDistance) ? 0 : lineDistance;
          }
          return distance;
        }
        case Shape.Point:
        case Shape.Polygon:
        case Shape.Rectangle:
          return null;
      }
    });
  }

  getPerimeter(geometry: PolygonGeometry | RectangleGeometry): number;
  getPerimeter(geometry: Geometry): number | null;
  getPerimeter(geometry: Geometry): number | null {
    return this.compute(geometry, 'perimeter', () => {
      switch (geometry.shape) {
        case Shape.Point:
        case Shape.Line:
          return null;
        case Shape.Polygon:
        case Shape.Rectangle: {
          let distance = 0;
          for (let i = 0; i < geometry.coordinates.length; i++) {
            const a = geometry.coordinates[i];
            const b = geometry.coordinates[(i + 1) % geometry.coordinates.length];
            const lineDistance = Cartesian3.distance(a, b);
            distance += isNaN(lineDistance) ? 0 : lineDistance;
          }
          return distance;
        }
      }
    });
  }

  private compute<K extends keyof Cache>(
    geometry: Geometry,
    key: K,
    make: () => Exclude<Cache[K], undefined>,
  ): Exclude<Cache[K], undefined> {
    const cache = ((geometry as GeometryWithCache)[CACHE_KEY] ??= {});
    const cachedValue = cache[key];
    if (cachedValue !== undefined) {
      return cachedValue as Exclude<Cache[K], undefined>;
    }
    const value = make();
    cache[key] = value;
    return value;
  }
}

const CACHE_KEY = Symbol('Feature.cache');

type GeometryWithCache = Geometry & {
  [CACHE_KEY]: Cache;
};

interface Cache {
  area?: number | null;
  length?: number | null;
  perimeter?: number | null;
}
