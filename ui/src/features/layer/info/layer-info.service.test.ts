import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BehaviorSubject, concat, from, of, Subject } from 'rxjs';
import { Cartesian2, Cartesian3, Viewer } from 'cesium';
import i18next from 'i18next';
import {
  AnyLayer,
  Layer,
  LayerType,
} from 'src/features/layer/models/layer.model';
import { Id, makeId } from 'src/models/id.model';
import { LayerInfo } from './layer-info.model';
import { LayerInfoPicker, LayerPickData } from './pickers/layer-info-picker';

const { inputAction, pickerClass } = vi.hoisted(() => ({
  inputAction: vi.fn(),
  pickerClass: () =>
    class {
      constructor(controller: { picker: LayerInfoPicker }) {
        return controller.picker;
      }
    },
}));

vi.mock('cesium', async (importOriginal) => ({
  ...(await importOriginal<typeof import('cesium')>()),
  ScreenSpaceEventHandler: class {
    setInputAction = inputAction;
  },
}));
vi.mock('src/features/layer', async () => ({
  ...(await import('src/features/layer/models/layer.model')),
  BACKGROUND_LAYER: { id: 'background' },
}));
vi.mock('src/features/layer/layer.service', () => ({
  LayerService: { inject: vi.fn() },
}));
vi.mock('src/services/pick.service', () => ({
  PickService: { inject: vi.fn() },
}));
vi.mock('src/services/cesium.service', () => ({
  CesiumService: { inject: vi.fn() },
}));
vi.mock('./pickers/layer-info-picker-for-tiles3d', () => ({
  LayerInfoPickerForTiles3d: pickerClass(),
}));
vi.mock('./pickers/layer-info-picker-for-geo-json', () => ({
  LayerInfoPickerForGeoJson: pickerClass(),
}));
vi.mock('./pickers/layer-info-picker-for-earthquakes', () => ({
  LayerInfoPickerForEarthquakes: pickerClass(),
}));
vi.mock('./pickers/layer-info-picker-for-voxels', () => ({
  LayerInfoPickerForVoxels: pickerClass(),
}));
vi.mock('./pickers/layer-info-picker-for-wmts', () => ({
  LayerInfoPickerForWmts: pickerClass(),
}));
vi.mock('./pickers/layer-info-picker-for-tiff', () => ({
  LayerInfoPickerForTiff: pickerClass(),
}));

import { LayerService } from 'src/features/layer/layer.service';
import { PickService } from 'src/services/pick.service';
import { CesiumService } from 'src/services/cesium.service';
import { LayerInfoService } from './layer-info.service';
import { splitLayerInfos } from './layer-info-results';

type LayerOptions = {
  id: string;
  type?: LayerType;
  isVisible?: boolean;
  opacity?: number;
  terrain?: object | null;
  active?: boolean;
};
const position = new Cartesian2(10, 20);
const globePosition = Cartesian3.fromDegrees(8, 47);
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const makeInfo = (
  id: string,
  match: LayerInfo['match'] = 'direct',
): LayerInfo => ({
  match,
  layerId: makeId(id),
  title: id,
  attributes: [],
  zoomToObject: vi.fn(),
  select: vi.fn(),
  deselect: vi.fn(),
  destroy: vi.fn(),
});

const setup = async (options: LayerOptions[]) => {
  const states = new Map(
    options.map((option) => [
      option.id,
      new BehaviorSubject({
        type: LayerType.Tiles3d,
        isVisible: true,
        opacity: 1,
        terrain: null,
        ...option,
      } as unknown as Layer),
    ]),
  );
  const background = new BehaviorSubject({ isVisible: true } as AnyLayer);
  const activation = new Subject<Id<Layer>>();
  const deactivation = new Subject<Id<Layer>>();
  const pickers = new Map(
    options.map(({ id }) => [
      id,
      {
        layerId: makeId<Layer>(id),
        pick: vi
          .fn<(data: LayerPickData) => Promise<LayerInfo[]>>()
          .mockResolvedValue([]),
        destroy: vi.fn(),
      },
    ]),
  );
  const controllers = new Map(
    options.map(({ id }) => [
      id,
      { type: states.get(id)!.value.type, picker: pickers.get(id) },
    ]),
  );
  let layerOrder = options
    .filter((option) => option.active !== false)
    .map((option) => makeId<Layer>(option.id));
  const layerService = {
    get activeLayerIds() {
      return layerOrder;
    },
    layerActivated$: concat(from(layerOrder), activation),
    layerDeactivated$: deactivation,
    layer$: (id: Id<AnyLayer>) =>
      id === 'background' ? background : states.get(String(id))!,
    controller: (id: Id<Layer>) => controllers.get(String(id)),
  };
  const canvas = { style: { cursor: 'default' } };
  const viewer = {
    canvas,
    scene: { camera: { positionWC: globePosition }, requestRender: vi.fn() },
  } as unknown as Viewer;
  vi.mocked(LayerService.inject).mockResolvedValue(
    layerService as unknown as LayerService,
  );
  vi.mocked(CesiumService.inject).mockResolvedValue({
    viewer$: of(viewer),
  } as unknown as CesiumService);
  const pickPosition = vi
    .fn<PickService['pick']>()
    .mockReturnValue(globePosition);
  vi.mocked(PickService.inject).mockResolvedValue({
    pick: pickPosition,
  } as unknown as PickService);
  const service = new LayerInfoService();
  let infos: readonly LayerInfo[] = [];
  service.infos$.subscribe((value) => {
    infos = value;
  });
  let selected: LayerInfo | null = null;
  service.selection$.subscribe((value) => {
    selected = value;
  });
  await service.initialize();
  return {
    service,
    pickPosition,
    pickers,
    background,
    activation,
    deactivation,
    canvas,
    get infos() {
      return infos;
    },
    get selected() {
      return selected;
    },
    reorder: (...ids: string[]) => {
      layerOrder = ids.map((id) => makeId<Layer>(id));
    },
    update: (id: string, patch: Partial<Layer>) => {
      const state = states.get(id)!;
      state.next({ ...state.value, ...patch } as Layer);
    },
    pick: () => service.pick3d(position, globePosition),
    finish: () => vi.waitFor(() => expect(canvas.style.cursor).toBe('default')),
  };
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => i18next.off('languageChanged'));

describe('LayerInfoService', () => {
  it('registers one click handler when initialized again', async () => {
    const { service } = await setup([]);

    await service.initialize();

    expect(inputAction).toHaveBeenCalledTimes(1);
  });

  it('selects a scene hit and separates the remaining direct and nearby features', async () => {
    const f = await setup([
      { id: 'geocover', type: LayerType.Wmts },
      { id: 'bedrock', type: LayerType.Tiff },
      { id: 'voxel', type: LayerType.Voxel },
    ]);
    const first = { ...makeInfo('geocover'), featureLabel: 'Niederterrasse' };
    const second = { ...makeInfo('geocover'), featureLabel: 'Niederterrasse' };
    const nearby = makeInfo('geocover', 'nearby');
    const sample = makeInfo('bedrock');
    const object = makeInfo('voxel', 'scene');
    f.pickers.get('geocover')!.pick.mockResolvedValue([nearby, first, second]);
    f.pickers.get('bedrock')!.pick.mockResolvedValue([sample]);
    f.pickers.get('voxel')!.pick.mockResolvedValue([object]);
    f.pick();
    await f.finish();

    expect(f.selected).toBe(object);
    expect(object.select).toHaveBeenCalledTimes(1);
    for (const secondary of [first, second, nearby, sample]) {
      expect(secondary.select).not.toHaveBeenCalled();
    }
    expect(splitLayerInfos(f.infos)).toEqual({
      exact: object,
      samePosition: [first, second, sample],
      nearby: [nearby],
    });

    f.service.selectInfo(second);
    expect(f.selected).toBe(second);
    expect(object.deselect).toHaveBeenCalledTimes(1);
    expect(second.select).toHaveBeenCalledTimes(1);
    f.service.selectInfo(nearby);
    expect(f.selected).toBe(nearby);
    expect(second.deselect).toHaveBeenCalledTimes(1);
    expect(nearby.select).toHaveBeenCalledTimes(1);
    f.service.selectInfo(nearby);
    expect(nearby.select).toHaveBeenCalledTimes(1);
  });

  it('uses the current displayed layer order for direct hits when no scene object is hit', async () => {
    const f = await setup([
      { id: 'nearby' },
      { id: 'first-registered' },
      { id: 'top-direct' },
    ]);
    const nearby = makeInfo('nearby', 'nearby');
    const firstRegistered = makeInfo('first-registered');
    const topDirect = makeInfo('top-direct');
    f.pickers.get('nearby')!.pick.mockResolvedValue([nearby]);
    f.pickers
      .get('first-registered')!
      .pick.mockResolvedValue([firstRegistered]);
    f.pickers.get('top-direct')!.pick.mockResolvedValue([topDirect]);
    f.reorder('nearby', 'top-direct', 'first-registered');

    f.pick();
    await f.finish();
    expect(f.infos).toEqual([topDirect, firstRegistered, nearby]);
    expect(f.selected).toBe(topDirect);
    expect(nearby.select).not.toHaveBeenCalled();
  });

  it('offers nearby-only matches without automatically highlighting them', async () => {
    const f = await setup([{ id: 'geocover', type: LayerType.Wmts }]);
    const nearby = makeInfo('geocover', 'nearby');
    f.pickers.get('geocover')!.pick.mockResolvedValue([nearby]);
    f.pick();
    await f.finish();

    expect(f.selected).toBeNull();
    expect(nearby.select).not.toHaveBeenCalled();
    expect(splitLayerInfos(f.infos)).toEqual({
      exact: null,
      samePosition: [],
      nearby: [nearby],
    });
    f.service.selectInfo(nearby);
    expect(f.selected).toBe(nearby);
    expect(nearby.select).toHaveBeenCalledTimes(1);
    f.service.reset();
    expect(f.selected).toBeNull();
    expect(nearby.deselect).toHaveBeenCalledTimes(1);
  });

  it('clears a selected hidden result and falls back to a remaining direct hit', async () => {
    const f = await setup([{ id: 'map' }, { id: 'object' }, { id: 'nearby' }]);
    const map = makeInfo('map');
    const object = makeInfo('object', 'scene');
    const nearby = makeInfo('nearby', 'nearby');
    f.pickers.get('map')!.pick.mockResolvedValue([map]);
    f.pickers.get('object')!.pick.mockResolvedValue([object]);
    f.pickers.get('nearby')!.pick.mockResolvedValue([nearby]);
    f.pick();
    await f.finish();

    f.update('object', { isVisible: false });
    expect(f.selected).toBe(map);
    expect(object.deselect).toHaveBeenCalledTimes(1);
    expect(object.destroy).toHaveBeenCalledTimes(1);
    f.service.selectInfo(object);
    expect(f.selected).toBe(map);
    f.update('map', { isVisible: false });
    expect(map.deselect).toHaveBeenCalledTimes(1);
    expect(f.selected).toBeNull();
    expect(nearby.select).not.toHaveBeenCalled();
  });

  it('previews a hovered feature without changing selection and restores the selected highlight on leave', async () => {
    const f = await setup([{ id: 'layer' }]);
    const exact = makeInfo('layer', 'scene');
    const same = makeInfo('layer');
    const nearby = makeInfo('layer', 'nearby');
    f.pickers.get('layer')!.pick.mockResolvedValue([exact, same, nearby]);
    f.pick();
    await f.finish();

    f.service.previewInfo(same);
    expect(f.selected).toBe(exact);
    expect(exact.deselect).toHaveBeenCalledTimes(1);
    expect(same.select).toHaveBeenCalledTimes(1);

    f.service.previewInfo(nearby);
    f.service.clearPreview(same);
    expect(same.deselect).toHaveBeenCalledTimes(1);
    expect(nearby.select).toHaveBeenCalledTimes(1);
    expect(nearby.deselect).not.toHaveBeenCalled();

    f.service.clearPreview(nearby);
    expect(nearby.deselect).toHaveBeenCalledTimes(1);
    expect(exact.select).toHaveBeenCalledTimes(2);
    expect(f.selected).toBe(exact);
  });

  it('keeps a hovered result highlighted when its row is opened, until selection and preview are both cleared', async () => {
    const f = await setup([{ id: 'layer' }]);
    const exact = makeInfo('layer', 'scene');
    const same = makeInfo('layer');
    f.pickers.get('layer')!.pick.mockResolvedValue([exact, same]);
    f.pick();
    await f.finish();

    f.service.previewInfo(same);
    f.service.selectInfo(same);
    f.service.clearPreview(same);
    expect(same.select).toHaveBeenCalledTimes(1);
    expect(same.deselect).not.toHaveBeenCalled();
    f.service.selectInfo(null);
    expect(same.deselect).toHaveBeenCalledTimes(1);
    expect(f.selected).toBeNull();
  });

  it('clears a hidden previewed feature, restores the selection, and ignores stale previews', async () => {
    const f = await setup([{ id: 'object' }, { id: 'nearby' }]);
    const object = makeInfo('object', 'scene');
    const nearby = makeInfo('nearby', 'nearby');
    f.pickers.get('object')!.pick.mockResolvedValue([object]);
    f.pickers.get('nearby')!.pick.mockResolvedValue([nearby]);
    f.pick();
    await f.finish();
    f.service.previewInfo(nearby);

    f.update('nearby', { isVisible: false });
    expect(nearby.deselect).toHaveBeenCalledTimes(1);
    expect(nearby.destroy).toHaveBeenCalledTimes(1);
    expect(object.select).toHaveBeenCalledTimes(2);

    f.service.previewInfo(nearby);
    expect(nearby.select).toHaveBeenCalledTimes(1);
    expect(object.deselect).toHaveBeenCalledTimes(1);
  });

  it.each(['missed scene', 'no layer results'])(
    'closes the current Info selection for %s',
    async (miss) => {
      const f = await setup([{ id: 'layer' }]);
      const result = makeInfo('layer', 'scene');
      const preview = makeInfo('layer', 'nearby');
      const picker = f.pickers.get('layer')!;
      picker.pick.mockResolvedValueOnce([result, preview]);
      f.pick();
      await f.finish();
      f.service.previewInfo(preview);

      if (miss === 'missed scene') {
        f.pickPosition.mockReturnValue(null);
      }
      f.service.pick2d(position);
      await f.finish();
      expect(f.infos).toEqual([]);
      expect(f.selected).toBeNull();
      expect(preview.deselect).toHaveBeenCalledTimes(1);
      expect(preview.destroy).toHaveBeenCalledTimes(1);
      expect(result.select).toHaveBeenCalledTimes(1);
    },
  );

  it('queries only active visible layers and keeps their individual feature results', async () => {
    const f = await setup([
      { id: 'visible' },
      { id: 'hidden', isVisible: false },
      { id: 'inactive', active: false },
      { id: 'transparent', opacity: 0 },
    ]);
    const infos = [makeInfo('visible'), makeInfo('visible')];
    infos[0].attributes = [{ key: 'Name', value: 'feature A' }];
    infos[1].attributes = [{ key: 'Name', value: 'feature B' }];
    f.pickers.get('visible')!.pick.mockResolvedValue(infos);
    f.pick();
    await f.finish();
    expect(f.infos).toEqual(infos);
    for (const id of ['hidden', 'inactive', 'transparent']) {
      expect(f.pickers.get(id)!.pick).not.toHaveBeenCalled();
    }
  });

  it.each([
    LayerType.Tiles3d,
    LayerType.GeoJson,
    LayerType.Earthquakes,
    LayerType.Voxel,
    LayerType.Wmts,
    LayerType.Tiff,
  ])('removes %s info and highlights immediately when hidden', async (type) => {
    const f = await setup([{ id: 'layer', type }]);
    const info = makeInfo('layer');
    f.pickers.get('layer')!.pick.mockResolvedValue([info]);
    f.pick();
    await f.finish();
    expect(f.infos).toEqual([info]);
    f.update('layer', { isVisible: false });
    expect(f.infos).toEqual([]);
    expect(info.destroy).toHaveBeenCalledTimes(1);
    expect(info.deselect).toHaveBeenCalledTimes(1);
    expect(f.selected).toBeNull();
  });

  it('suppresses draped layers with the basemap off but preserves independent 3D layers', async () => {
    const f = await setup([
      { id: 'wmts', type: LayerType.Wmts },
      { id: 'tiff', type: LayerType.Tiff },
      { id: 'geojson', type: LayerType.GeoJson },
      { id: '3d' },
      { id: 'own-terrain', type: LayerType.GeoJson, terrain: {} },
    ]);
    const infos = [...f.pickers.keys()].map((id) => makeInfo(id));
    for (const info of infos) {
      f.pickers.get(String(info.layerId))!.pick.mockResolvedValue([info]);
    }
    f.pick();
    await f.finish();
    f.background.next({ isVisible: false } as AnyLayer);
    expect(f.infos.map((info) => info.layerId)).toEqual(['3d', 'own-terrain']);
    for (const info of infos.slice(0, 3)) {
      expect(info.destroy).toHaveBeenCalledTimes(1);
    }
    for (const picker of f.pickers.values()) {
      picker.pick.mockClear();
    }
    f.pick();
    await f.finish();
    for (const id of ['wmts', 'tiff', 'geojson']) {
      expect(f.pickers.get(id)!.pick).not.toHaveBeenCalled();
    }
  });

  it.each(['hide', 'hide-show', 'remove', 'basemap', 'close'] as const)(
    'discards a delayed response after %s',
    async (change) => {
      const f = await setup([{ id: 'layer', type: LayerType.Wmts }]);
      const pending = deferred<LayerInfo[]>();
      const picker = f.pickers.get('layer')!;
      picker.pick.mockReturnValue(pending.promise);
      f.pick();
      await vi.waitFor(() => expect(picker.pick).toHaveBeenCalled());
      if (change === 'hide' || change === 'hide-show') {
        f.update('layer', { isVisible: false });
      }
      if (change === 'hide-show') {
        f.update('layer', { isVisible: true });
      }
      if (change === 'remove') {
        f.deactivation.next(makeId('layer'));
      }
      if (change === 'basemap') {
        f.background.next({ isVisible: false } as AnyLayer);
      }
      if (change === 'close') {
        f.service.reset();
      }
      const info = makeInfo('layer');
      pending.resolve([info]);
      await vi.waitFor(() => expect(info.destroy).toHaveBeenCalledTimes(1));
      expect(f.infos).toEqual([]);
      await f.finish();
    },
  );

  it('disposes of an unpublished result when its layer is hidden', async () => {
    const f = await setup([
      { id: 'fast' },
      { id: 'slow', type: LayerType.Wmts },
    ]);
    const pending = deferred<LayerInfo[]>();
    const fast = makeInfo('fast');
    const slow = makeInfo('slow');
    f.pickers.get('fast')!.pick.mockResolvedValue([fast]);
    f.pickers.get('slow')!.pick.mockReturnValue(pending.promise);
    f.pick();
    await vi.waitFor(() =>
      expect(f.pickers.get('slow')!.pick).toHaveBeenCalled(),
    );
    f.update('fast', { isVisible: false });
    expect(fast.destroy).toHaveBeenCalledTimes(1);
    pending.resolve([slow]);
    await f.finish();
    expect(f.infos).toEqual([slow]);
    expect(fast.destroy).toHaveBeenCalledTimes(1);
  });

  it('replaces a pending click with the newest feature selection', async () => {
    const f = await setup([{ id: 'layer' }]);
    const pending = deferred<LayerInfo[]>();
    const first = makeInfo('layer');
    const second = makeInfo('layer');
    second.attributes = [{ key: 'Name', value: 'new feature' }];
    const picker = f.pickers.get('layer')!;
    picker.pick
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce([second]);
    f.pick();
    await vi.waitFor(() => expect(picker.pick).toHaveBeenCalledTimes(1));
    f.pick();
    pending.resolve([first]);
    await vi.waitFor(() => expect(f.infos).toEqual([second]));
    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(first.select).not.toHaveBeenCalled();
    expect(second.select).toHaveBeenCalledTimes(1);
    expect(second.destroy).not.toHaveBeenCalled();
    await f.finish();
  });

  it('allows a fresh click after a hidden layer is shown again', async () => {
    const f = await setup([{ id: 'layer' }]);
    const first = makeInfo('layer');
    const second = makeInfo('layer');
    const picker = f.pickers.get('layer')!;
    picker.pick.mockResolvedValueOnce([first]).mockResolvedValueOnce([second]);
    f.pick();
    await f.finish();
    f.update('layer', { isVisible: false });
    f.update('layer', { isVisible: true });
    expect(f.infos).toEqual([]);
    f.pick();
    await f.finish();
    expect(f.infos).toEqual([second]);
    expect(first.destroy).toHaveBeenCalledTimes(1);
  });

  it.each(['hide', 'remove'] as const)(
    'publishes translated attributes for surviving results after another layer is changed (%s)',
    async (change) => {
      const f = await setup([
        { id: 'map', type: LayerType.Wmts },
        { id: 'other' },
      ]);
      const pending = deferred<void>();
      const translated: LayerInfo = {
        ...makeInfo('map'),
        attributes: [{ key: 'Name', value: 'Deutsch' }],
        refreshForLanguage: vi.fn(async () => {
          await pending.promise;
          translated.attributes = [{ key: 'Name', value: 'Français' }];
        }),
      };
      const other = makeInfo('other');
      f.pickers.get('map')!.pick.mockResolvedValue([translated]);
      f.pickers.get('other')!.pick.mockResolvedValue([other]);
      f.pick();
      await f.finish();

      const publishedValues: unknown[] = [];
      const subscription = f.service.infos$.subscribe((infos) => {
        publishedValues.push(
          infos.find((info) => info === translated)?.attributes[0]?.value,
        );
      });
      try {
        i18next.emit('languageChanged', 'fr');
        if (change === 'hide') {
          f.update('other', { isVisible: false });
        } else {
          f.deactivation.next(makeId('other'));
        }
        pending.resolve();
        await vi.waitFor(() => expect(publishedValues.at(-1)).toBe('Français'));
        expect(f.infos).toEqual([translated]);
        expect(other.destroy).toHaveBeenCalledTimes(1);
      } finally {
        subscription.unsubscribe();
      }
    },
  );

  it('does not resurrect removed info after a language refresh', async () => {
    const f = await setup([{ id: 'layer', type: LayerType.Wmts }]);
    const pending = deferred<void>();
    const info = {
      ...makeInfo('layer'),
      refreshForLanguage: vi.fn(() => pending.promise),
    };
    f.pickers.get('layer')!.pick.mockResolvedValue([info]);
    f.pick();
    await f.finish();
    i18next.emit('languageChanged', 'fr');
    expect(info.refreshForLanguage).toHaveBeenCalled();
    f.update('layer', { isVisible: false });
    pending.resolve();
    await pending.promise;
    expect(f.infos).toEqual([]);
    expect(info.destroy).toHaveBeenCalledTimes(1);
  });

  it('clears a removed layer and ignores it on subsequent clicks', async () => {
    const f = await setup([{ id: 'layer' }]);
    const info = makeInfo('layer');
    const picker = f.pickers.get('layer')!;
    picker.pick.mockResolvedValue([info]);
    f.pick();
    await f.finish();
    f.deactivation.next(makeId('layer'));
    expect(f.infos).toEqual([]);
    expect(info.destroy).toHaveBeenCalledTimes(1);
    expect(picker.destroy).toHaveBeenCalledTimes(1);
    picker.pick.mockClear();
    f.pick();
    await f.finish();
    expect(picker.pick).not.toHaveBeenCalled();
  });
});
