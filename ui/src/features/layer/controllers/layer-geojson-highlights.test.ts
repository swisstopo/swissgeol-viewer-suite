import { describe, expect, it, vi } from 'vitest';
import {
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  ColorMaterialProperty,
  CustomDataSource,
  Entity,
  JulianDate,
  Viewer,
} from 'cesium';
import { makeId } from 'src/models/id.model';
import { LayerType } from 'src/features/layer/models/layer.model';
import { GeoJsonLayerController } from './layer.geojson.controller';
import { LayerInfoPickerForGeoJson } from '../info/pickers/layer-info-picker-for-geo-json';

vi.mock('src/features/layer', async () => ({
  ...(await import('src/features/layer/models/layer.model')),
  BaseLayerController: class {},
  Tiles3dLayerController: class {},
}));
vi.mock('src/features/layer/utils/layer-style.utils', () => ({
  getStyleForProperty: vi.fn(),
  createCanvasForBillboard: vi.fn(),
}));
vi.mock('src/constants', async () => ({
  DRILL_PICK_LIMIT: 2,
  DRILL_PICK_LENGTH: 1,
  GEOMETRY_DATASOURCE_NAME: 'drawings',
  NO_EDIT_GEOMETRY_DATASOURCE_NAME: 'readonly-drawings',
  OBJECT_HIGHLIGHT_COLOR: (await import('cesium')).Color.YELLOW,
}));

const setup = async (
  geometry: 'polygon' | 'polyline',
  material: ColorMaterialProperty,
) => {
  const source = new CustomDataSource('geojson');
  const entity = source.entities.add(
    new Entity({ properties: { Name: 'unit' }, [geometry]: { material } }),
  );
  const controller: GeoJsonLayerController = Object.assign(
    Object.create(GeoJsonLayerController.prototype),
    {
      dataSource: source,
      layer: {
        id: makeId('geojson'),
        type: LayerType.GeoJson,
        isVisible: true,
        opacity: 1,
        orderOfProperties: [],
      },
    },
  );
  const viewer = {
    scene: { drillPick: () => [{ id: entity, primitive: {} }] },
    dataSources: { getByName: () => [] },
  } as unknown as Viewer;
  const [info] = await new LayerInfoPickerForGeoJson(controller, viewer).pick({
    windowPosition: new Cartesian2(10, 20),
    globePosition: {
      cartesian: Cartesian3.fromDegrees(8, 47),
      cartographic: Cartographic.fromDegrees(8, 47),
    },
    distance: 100,
  });
  return { entity, controller, info };
};

describe('GeoJSON opacity while highlighted', () => {
  it.each(['polygon', 'polyline'] as const)(
    'restores the base hue and latest opacity after a highlighted %s is deselected',
    async (geometry) => {
      const { entity, controller, info } = await setup(
        geometry,
        new ColorMaterialProperty(Color.BLUE),
      );
      info.select();
      controller['setLayerOpacity'](0.6);
      controller['setLayerOpacity'](0.3);
      expect(entity[geometry]!.material!.getValue().color).toEqual(
        Color.YELLOW.withAlpha(0.3),
      );

      info.deselect();
      expect(entity[geometry]!.material!.getValue().color).toEqual(
        Color.BLUE.withAlpha(0.3),
      );
      info.select();
      expect(entity[geometry]!.material!.getValue().color).toEqual(
        Color.YELLOW.withAlpha(0.3),
      );
      info.destroy();
      expect(entity[geometry]!.material!.getValue().color).toEqual(
        Color.BLUE.withAlpha(0.3),
      );
    },
  );

  it('preserves a dynamic base color when opacity changes during highlighting', async () => {
    const early = JulianDate.fromIso8601('2026-01-01');
    const late = JulianDate.fromIso8601('2026-02-01');
    const material = new ColorMaterialProperty(
      new CallbackProperty(
        (time) => (JulianDate.equals(time, early) ? Color.BLUE : Color.RED),
        false,
      ),
    );
    const { entity, controller, info } = await setup('polygon', material);
    info.select();
    controller['setLayerOpacity'](0.4);
    info.destroy();

    expect(entity.polygon!.material!.getValue(early).color).toEqual(
      Color.BLUE.withAlpha(0.4),
    );
    expect(entity.polygon!.material!.getValue(late).color).toEqual(
      Color.RED.withAlpha(0.4),
    );
  });
});
