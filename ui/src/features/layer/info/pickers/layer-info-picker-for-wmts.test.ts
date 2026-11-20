import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  DataSourceCollection,
  Viewer,
} from 'cesium';
import type { WmtsLayerController } from 'src/features/layer/controllers/layer-wmts.controller';
import type { WmtsLayer } from 'src/features/layer/models/layer-wmts.model';
import { makeId } from 'src/models/id.model';
import { radiansToLv95 } from 'src/projection';
import { LayerInfoPickerForWmts } from './layer-info-picker-for-wmts';
import type { IdentifiedGeometry } from './layer-info-picker-for-wmts.service';
import {
  distanceToWmtsGeometry,
  isDirectWmtsMatch,
} from './layer-info-wmts-geometry';

const service = vi.hoisted(() => ({
  shouldUseGeoAdminIdentify: vi.fn(),
  fetchIdentifyResults: vi.fn(),
  fetchServiceFeatureInfo: vi.fn(),
  fetchHtmlPopup: vi.fn(),
  extractPopupAttributes: vi.fn(),
  mapFeaturePropertiesToAttributes: vi.fn(),
}));

vi.mock('./layer-info-picker-for-wmts.service', () => ({
  LayerInfoPickerForWmtsService: class {
    constructor() {
      return service;
    }
  },
}));

const ring = (x: number, y: number, size: number) => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
  [x, y],
];

const createPicker = () => {
  const dataSources = new DataSourceCollection();
  const zoomTo = vi.fn().mockResolvedValue(true);
  const viewer = {
    dataSources,
    scene: { requestRender: vi.fn(), cameraUnderground: false },
    zoomTo,
  } as unknown as Viewer;
  const controller = {
    layer: { id: makeId<WmtsLayer>('geocover'), isVisible: true },
  } as WmtsLayerController;
  const picker = new LayerInfoPickerForWmts(controller, viewer);
  const cartographic = Cartographic.fromDegrees(7, 46);
  const [x, y] = radiansToLv95([cartographic.longitude, cartographic.latitude]);
  return {
    dataSources,
    picker,
    x,
    y,
    zoomTo,
    pick: () =>
      picker.pick({
        distance: 8000,
        globePosition: {
          cartographic,
          cartesian: Cartesian3.fromRadians(
            cartographic.longitude,
            cartographic.latitude,
          ),
        },
        windowPosition: Cartesian2.ZERO,
      }),
  };
};

beforeEach(() => {
  vi.resetAllMocks();
  service.shouldUseGeoAdminIdentify.mockReturnValue(true);
  service.fetchHtmlPopup.mockResolvedValue('');
  service.extractPopupAttributes.mockReturnValue([]);
  service.mapFeaturePropertiesToAttributes.mockReturnValue([]);
});

describe('WMTS info features', () => {
  it('keeps overlapping direct features and separates nearby features regardless of API order', async () => {
    const f = createPicker();
    service.fetchIdentifyResults.mockResolvedValue([
      {
        featureId: 3,
        properties: { label: 'Niederterrasse' },
        geometry: { type: 'Polygon', coordinates: [ring(f.x + 8, f.y - 2, 4)] },
      },
      {
        featureId: 2,
        properties: { label: 'Gümmenen-Fm.' },
        geometry: { type: 'Polygon', coordinates: [ring(f.x - 3, f.y - 3, 6)] },
      },
      {
        featureId: 1,
        properties: { label: 'Niederterrasse' },
        geometry: { type: 'Polygon', coordinates: [ring(f.x - 4, f.y - 4, 8)] },
      },
      {
        featureId: 4,
        properties: { label: '-' },
        geometry: { type: 'Point', coordinates: [f.x + 5, f.y] },
      },
    ]);

    const results = await f.pick();
    expect(
      results.map(({ featureLabel, match, distance }) => [
        featureLabel,
        match,
        distance,
      ]),
    ).toEqual([
      ['Gümmenen-Fm.', 'direct', 0],
      ['Niederterrasse (#1)', 'direct', 0],
      ['#4', 'nearby', 5],
      ['Niederterrasse (#3)', 'nearby', 8],
    ]);
  });

  it('adds full WMTS geometry only when selected, and removes it on deselect or destroy', async () => {
    const f = createPicker();
    service.fetchIdentifyResults.mockResolvedValue([
      {
        featureId: 1,
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [ring(f.x - 10, f.y - 10, 20), ring(f.x + 1, f.y + 1, 5)],
            [ring(f.x + 10, f.y + 10, 20)],
          ],
        },
      },
      {
        featureId: 2,
        geometry: { type: 'Point', coordinates: [f.x + 8, f.y] },
      },
    ]);
    const [polygon, point] = await f.pick();
    const collection = f.dataSources.get(0).entities;
    expect(collection.values).toHaveLength(0);

    polygon.select();
    expect(collection.values).toHaveLength(2);
    expect(
      collection.values[0].polygon?.hierarchy?.getValue().holes,
    ).toHaveLength(1);
    polygon.select();
    expect(collection.values).toHaveLength(2);

    polygon.zoomToObject();
    expect(f.zoomTo).toHaveBeenCalledWith(collection.values);

    polygon.deselect();
    point.select();
    expect(collection.values).toHaveLength(1);
    expect(collection.values[0].point).toBeDefined();

    point.destroy();
    expect(collection.values).toHaveLength(0);
  });

  it('treats geometry-less GetFeatureInfo hits as results at the queried WMS pixel', async () => {
    const f = createPicker();
    service.shouldUseGeoAdminIdentify.mockReturnValue(false);
    service.fetchServiceFeatureInfo.mockResolvedValue([
      { id: 'raster.value', properties: { name: 'Inclination' } },
    ]);

    const [result] = await f.pick();
    expect(result).toMatchObject({
      featureLabel: 'Inclination',
      match: 'direct',
      distance: 0,
    });
    expect(f.dataSources.get(0).entities.values).toHaveLength(0);
    result.select();
    expect(f.dataSources.get(0).entities.values[0].point).toBeDefined();
    result.destroy();
  });
});

describe('WMTS geometry distance', () => {
  it('counts a polygon hole as nearby and its boundary as direct', () => {
    const geometry: IdentifiedGeometry = {
      type: 'Polygon',
      coordinates: [ring(0, 0, 40), ring(10, 10, 20)],
    };
    expect(distanceToWmtsGeometry([4, 4], geometry)).toBe(0);
    expect(distanceToWmtsGeometry([18, 20], geometry)).toBe(8);
    expect(isDirectWmtsMatch(distanceToWmtsGeometry([18, 20], geometry))).toBe(
      false,
    );
    expect(isDirectWmtsMatch(distanceToWmtsGeometry([10, 20], geometry))).toBe(
      true,
    );
  });

  it('uses the closest part of a multipolygon', () => {
    const geometry: IdentifiedGeometry = {
      type: 'MultiPolygon',
      coordinates: [[ring(0, 0, 10)], [ring(50, 50, 5)]],
    };
    expect(distanceToWmtsGeometry([51, 51], geometry)).toBe(0);
    expect(distanceToWmtsGeometry([53, 58], geometry)).toBe(3);
  });

  it('measures to the line itself, including the interior of a segment', () => {
    const geometry: IdentifiedGeometry = {
      type: 'MultiLineString',
      coordinates: [
        [
          [0, 0],
          [0, 95],
        ],
        [
          [10, 0],
          [10, 95],
        ],
      ],
    };
    expect(distanceToWmtsGeometry([8, 55], geometry)).toBe(2);
    expect(isDirectWmtsMatch(distanceToWmtsGeometry([10, 55], geometry))).toBe(
      true,
    );
  });

  it('uses the closest point of a multipoint', () => {
    const geometry: IdentifiedGeometry = {
      type: 'MultiPoint',
      coordinates: [
        [0, 0],
        [10, 10],
      ],
    };
    expect(distanceToWmtsGeometry([10, 12], geometry)).toBe(2);
    expect(isDirectWmtsMatch(distanceToWmtsGeometry([10, 10], geometry))).toBe(
      true,
    );
  });
});
