import { describe, expect, it, vi } from 'vitest';
import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Cesium3DTileContent,
  Cesium3DTileFeature,
  Cesium3DTileset,
  Color,
  CustomDataSource,
  Entity,
  Viewer,
} from 'cesium';
import type { BaseLayerController } from 'src/features/layer/controllers/layer.controller';
import { Layer, LayerType } from 'src/features/layer/models/layer.model';
import type { Tiles3dLayer } from 'src/features/layer/models/layer-tiles3d.model';
import type { GeoJsonLayer } from 'src/features/layer/models/layer-geojson.model';
import type { EarthquakesLayer } from 'src/features/layer/models/layer-earthquakes.model';
import { makeId } from 'src/models/id.model';
import { LayerInfoPickerForTiles3d } from './layer-info-picker-for-tiles3d';
import { LayerInfoPickerForGeoJson } from './layer-info-picker-for-geo-json';
import { LayerInfoPickerForEarthquakes } from './layer-info-picker-for-earthquakes';
import { LayerPickData } from './layer-info-picker';

vi.mock(
  'src/features/layer',
  async () => import('src/features/layer/models/layer.model'),
);
vi.mock('src/constants', async () => {
  const { Color } = await import('cesium');
  return {
    DRILL_PICK_LIMIT: 2,
    DRILL_PICK_LENGTH: 1,
    GEOMETRY_DATASOURCE_NAME: 'drawings',
    NO_EDIT_GEOMETRY_DATASOURCE_NAME: 'readonly-drawings',
    OBJECT_HIGHLIGHT_COLOR: Color.YELLOW,
    OBJECT_ZOOMTO_RADIUS: 500,
  };
});

const data = (): LayerPickData => ({
  windowPosition: new Cartesian2(10, 20),
  globePosition: {
    cartesian: Cartesian3.fromDegrees(8, 47),
    cartographic: Cartographic.fromDegrees(8, 47),
  },
  distance: 100,
});
const makeViewer = (objects: unknown[], slicer?: CustomDataSource) => {
  const drillPick = vi.fn(() => objects);
  return {
    drillPick,
    viewer: {
      scene: { drillPick },
      dataSources: {
        getByName: (name: string) =>
          name === 'slicer' && slicer ? [slicer] : [],
      },
    } as unknown as Viewer,
  };
};
const makeController = <T extends Layer>(
  id: string,
  type: LayerType,
  objects: Array<Cesium3DTileset | Entity>,
) =>
  ({
    layer: {
      id: makeId(id),
      type,
      isVisible: true,
      opacity: 1,
      orderOfProperties: [],
    },
    ownsSceneObject: (object: Cesium3DTileset | Entity) =>
      objects.includes(object),
  }) as unknown as BaseLayerController<T>;

const makeFeature = (
  tileset: Cesium3DTileset,
  name: string,
  vector: boolean,
) => {
  let color = Color.clone(Color.RED.withAlpha(0.6));
  const properties: Record<string, string> = { Name: name };
  const api = {
    getPropertyIds: () => Object.keys(properties),
    getProperty: (_id: number, key: string) => properties[key],
    getColor: (_id: number, result: Color) => Color.clone(color, result),
    setColor: (_id: number, value: Color) => {
      color = Color.clone(value);
    },
  };
  if (!vector) {
    return new Cesium3DTileFeature(
      { tileset, batchTable: api } as unknown as Cesium3DTileContent,
      0,
    );
  }
  properties.Hex_color = '#ff0000';
  return {
    tileset,
    addPrimitiveByCollection: () => {},
    get color() {
      return color;
    },
    set color(value: Color) {
      color = Color.clone(value);
    },
    getPropertyIds: api.getPropertyIds,
    getProperty: (key: string) => properties[key],
  };
};

describe('layer scene picking', () => {
  it.each([false, true])(
    'preserves per-feature attributes and restores colors (vector=%s)',
    async (vector) => {
      const tileset = { isDestroyed: () => false } as Cesium3DTileset;
      const first = makeFeature(tileset, 'upper unit', vector);
      const second = makeFeature(tileset, 'lower unit', vector);
      const original = Color.clone(first.color);
      const f = makeViewer([first]);
      const controller = makeController<Tiles3dLayer>(
        'geology',
        LayerType.Tiles3d,
        [tileset],
      );
      const picker = new LayerInfoPickerForTiles3d(controller, f.viewer);
      const [info] = await picker.pick(data());
      expect(info.layerId).toBe('geology');
      expect(info.attributes.map((a) => a.value)).toEqual(['upper unit']);
      expect(first.color).not.toEqual(original);
      expect(second.color).toEqual(original);
      info.destroy();
      expect(first.color).toEqual(original);
      f.drillPick.mockReturnValue([second]);
      const [nextInfo] = await picker.pick(data());
      expect(nextInfo.attributes.map((a) => a.value)).toEqual(['lower unit']);
      nextInfo.destroy();
      expect(second.color).toEqual(original);
    },
  );

  it.each([false, true])(
    'returns only the frontmost feature under its owning layer (vector=%s)',
    async (vector) => {
      const frontTileset = { isDestroyed: () => false } as Cesium3DTileset;
      const backTileset = { isDestroyed: () => false } as Cesium3DTileset;
      const front = makeFeature(frontTileset, 'front', vector);
      const back = makeFeature(backTileset, 'back', vector);
      const originalBack = Color.clone(back.color);
      const f = makeViewer([front, back]);
      const frontPicker = new LayerInfoPickerForTiles3d(
        makeController<Tiles3dLayer>('front-layer', LayerType.Tiles3d, [
          frontTileset,
        ]),
        f.viewer,
      );
      const backPicker = new LayerInfoPickerForTiles3d(
        makeController<Tiles3dLayer>('back-layer', LayerType.Tiles3d, [
          backTileset,
        ]),
        f.viewer,
      );
      const frontInfos = await frontPicker.pick(data());
      expect(frontInfos.map((info) => info.layerId)).toEqual(['front-layer']);
      expect(await backPicker.pick(data())).toEqual([]);
      expect(back.color).toEqual(originalBack);
      frontInfos[0].destroy();
    },
  );

  it('matches metadata-only model hits to their own tileset', async () => {
    const setUniform = vi.fn();
    const tileset = {
      metadata: {
        getPropertyIds: () => ['Name'],
        getProperty: () => ['model metadata'],
      },
      customShader: { setUniform },
      isDestroyed: () => false,
    } as unknown as Cesium3DTileset;
    const model = { content: { _tileset: tileset } };
    const f = makeViewer([model]);
    const owned = new LayerInfoPickerForTiles3d(
      makeController<Tiles3dLayer>('owner', LayerType.Tiles3d, [tileset]),
      f.viewer,
    );
    const unrelated = new LayerInfoPickerForTiles3d(
      makeController<Tiles3dLayer>('other', LayerType.Tiles3d, [
        {} as Cesium3DTileset,
      ]),
      f.viewer,
    );
    expect(await unrelated.pick(data())).toEqual([]);
    expect(setUniform).not.toHaveBeenCalled();
    const [info] = await owned.pick(data());
    expect(info.attributes.map((a) => a.value)).toEqual(['model metadata']);
    expect(setUniform).toHaveBeenLastCalledWith('u_isHighlighted', true);
    info.destroy();
    expect(setUniform).toHaveBeenLastCalledWith('u_isHighlighted', false);
  });

  it('recognizes any owned tileset, including a non-first seismic axis', async () => {
    const firstAxis = {} as Cesium3DTileset;
    const secondAxis = { isDestroyed: () => false } as Cesium3DTileset;
    const feature = makeFeature(secondAxis, 'second axis feature', false);
    const f = makeViewer([feature]);
    const picker = new LayerInfoPickerForTiles3d(
      makeController<Tiles3dLayer>('seismic', LayerType.Tiles3d, [
        firstAxis,
        secondAxis,
      ]),
      f.viewer,
    );
    const [info] = await picker.pick(data());
    expect(info.attributes.map((a) => a.value)).toEqual([
      'second axis feature',
    ]);
    info.destroy();
  });

  it('skips slicing helpers without skipping the frontmost actual feature', async () => {
    const slicer = new CustomDataSource('slicer');
    const helper = slicer.entities.add(new Entity());
    const tileset = { isDestroyed: () => false } as Cesium3DTileset;
    const feature = makeFeature(tileset, 'visible', false);
    const f = makeViewer([{ id: helper }, feature], slicer);
    const picker = new LayerInfoPickerForTiles3d(
      makeController<Tiles3dLayer>('layer', LayerType.Tiles3d, [tileset]),
      f.viewer,
    );
    const [info] = await picker.pick(data());
    expect(info.attributes.map((a) => a.value)).toEqual(['visible']);
    info.destroy();
  });

  it.each(['geojson', 'earthquakes'] as const)(
    'keeps %s entity attributes with their owner and selects only the front hit',
    async (format) => {
      const front = new Entity({
        properties: { Name: 'front feature' },
        polygon: { material: Color.BLUE },
      });
      const back = new Entity({
        properties: { Name: 'back feature' },
        polygon: { material: Color.RED },
      });
      const f = makeViewer([
        { id: front, primitive: {} },
        { id: back, primitive: {} },
      ]);
      const buildPicker = (id: string, objects: Entity[]) =>
        format === 'geojson'
          ? new LayerInfoPickerForGeoJson(
              makeController<GeoJsonLayer>(id, LayerType.GeoJson, objects),
              f.viewer,
            )
          : new LayerInfoPickerForEarthquakes(
              makeController<EarthquakesLayer>(
                id,
                LayerType.Earthquakes,
                objects,
              ),
              f.viewer,
            );
      const picker = buildPicker('owner', [front, back]);
      expect(await buildPicker('unrelated', []).pick(data())).toEqual([]);
      const [info] = await picker.pick(data());
      expect(info.layerId).toBe('owner');
      expect(info.attributes.map((a) => a.value)).toEqual([
        front.id,
        'front feature',
      ]);
      info.destroy();
      f.drillPick.mockReturnValue([{ id: back, primitive: {} }]);
      const [nextInfo] = await picker.pick(data());
      expect(nextInfo.attributes.map((a) => a.value)).toEqual([
        back.id,
        'back feature',
      ]);
      nextInfo.destroy();
    },
  );

  it.each([
    { isVisible: false, opacity: 1 },
    { isVisible: true, opacity: 0 },
  ])('does not pick or highlight a hidden layer (%j)', async (visibility) => {
    const tileset = { isDestroyed: () => false } as Cesium3DTileset;
    const feature = makeFeature(tileset, 'hidden', false);
    const original = Color.clone(feature.color);
    const f = makeViewer([feature]);
    const controller = makeController<Tiles3dLayer>(
      'hidden',
      LayerType.Tiles3d,
      [tileset],
    );
    Object.assign(controller.layer, visibility);
    expect(
      await new LayerInfoPickerForTiles3d(controller, f.viewer).pick(data()),
    ).toEqual([]);
    expect(f.drillPick).not.toHaveBeenCalled();
    expect(feature.color).toEqual(original);
  });

  it('does not restore feature colors after the owning tileset has been destroyed', async () => {
    const isDestroyed = vi.fn(() => false);
    const tileset = { isDestroyed } as unknown as Cesium3DTileset;
    const feature = makeFeature(tileset, 'removed feature', false);
    const f = makeViewer([feature]);
    const picker = new LayerInfoPickerForTiles3d(
      makeController<Tiles3dLayer>('layer', LayerType.Tiles3d, [tileset]),
      f.viewer,
    );
    const [info] = await picker.pick(data());
    isDestroyed.mockReturnValue(true);
    const colorSetter = vi.spyOn(feature, 'color', 'set');
    expect(() => info.destroy()).not.toThrow();
    expect(colorSetter).not.toHaveBeenCalled();
  });

  it('does not leak unowned KML or drawing entities into a layer', async () => {
    const f = makeViewer([
      {
        id: new Entity({ properties: { Name: 'foreign entity' } }),
        primitive: {},
      },
    ]);
    const picker = new LayerInfoPickerForGeoJson(
      makeController<GeoJsonLayer>('geojson', LayerType.GeoJson, []),
      f.viewer,
    );
    expect(await picker.pick(data())).toEqual([]);
  });
});
