import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  EntityCollection,
  Resource,
  Viewer,
} from 'cesium';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TiffLayer, TiffLayerController } from 'src/features/layer';
import { makeId } from 'src/models/id.model';
import { LayerInfoPickerForTiff } from './layer-info-picker-for-tiff';

vi.mock('src/features/layer', () => ({
  getTranslationKeyForLayerAttributeName: (_layer: unknown, name: string) =>
    name,
  mapLayerSourceToResource: () => ({
    url: 'https://example.invalid/test.tiff',
  }),
}));
vi.mock('src/constants', async () => ({
  OBJECT_HIGHLIGHT_COLOR: (await import('cesium')).Color.YELLOW,
  TITILER_BY_PAGE_HOST: { localhost: 'https://example.invalid' },
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('TIFF Info highlights', () => {
  it('returns a direct sample without adding a marker before selection', async () => {
    vi.stubGlobal('location', { host: 'localhost' });
    vi.spyOn(Resource, 'fetchJson')
      .mockResolvedValueOnce({
        crs: 'http://www.opengis.net/def/crs/EPSG/0/4326',
        bounds: [6, 45, 10, 48],
        width: 40,
        height: 30,
      })
      .mockResolvedValueOnce({ values: [12] });
    const entities = new EntityCollection();
    const viewer = {
      entities,
      isDestroyed: () => false,
    } as unknown as Viewer;
    const controller = {
      layer: {
        id: makeId<TiffLayer>('raster'),
        isVisible: true,
        bands: [{ index: 1, name: 'sample' }],
        bandIndex: 0,
        cellSize: 10,
      },
    } as unknown as TiffLayerController;
    const [info] = await new LayerInfoPickerForTiff(controller, viewer).pick({
      windowPosition: new Cartesian2(12, 24),
      globePosition: {
        cartesian: Cartesian3.fromDegrees(8, 47),
        cartographic: Cartographic.fromDegrees(8, 47),
      },
      distance: 100,
    });

    expect(info.match).toBe('direct');
    expect(info.attributes.map((attribute) => attribute.value)).toEqual([12]);
    expect(entities.values).toEqual([]);
    info.select();
    info.select();
    expect(entities.values).toHaveLength(1);
    expect(entities.values[0].polygon!.material!.getValue().color).toEqual(
      Color.YELLOW.withAlpha(0.6),
    );
    info.deselect();
    expect(entities.values).toEqual([]);
    info.select();
    info.destroy();
    expect(entities.values).toEqual([]);
  });
});
