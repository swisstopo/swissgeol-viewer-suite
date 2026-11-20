import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Viewer,
  VoxelCell,
} from 'cesium';
import { describe, expect, it, vi } from 'vitest';
import type { VoxelLayer, VoxelLayerController } from 'src/features/layer';
import { makeId } from 'src/models/id.model';
import { LayerInfoPickerForVoxels } from './layer-info-picker-for-voxels';

vi.mock(
  'src/features/layer',
  async () => import('src/features/layer/models/layer.model'),
);
vi.mock('src/projection', () => ({
  formatCartesian3AsLv95: () => [2600000, 1200000, 900],
}));
vi.mock('src/constants', () => ({ DRILL_PICK_LENGTH: 1 }));

describe('voxel Info highlights', () => {
  it('samples at the scene pick aperture and sets shader uniforms only while selected', async () => {
    const uniforms = {
      u_selectedTile: { value: -1 },
      u_selectedSample: { value: -1 },
    };
    const setUniform = vi.fn((name: keyof typeof uniforms, value: number) => {
      uniforms[name].value = value;
    });
    const primitive = {
      isDestroyed: () => false,
      customShader: { uniforms, setUniform },
    };
    const cell = {
      primitive,
      tileIndex: 3,
      sampleIndex: 7,
      orientedBoundingBox: { center: Cartesian3.fromDegrees(8, 47) },
      getNames: () => ['temperature'],
      getProperty: () => [11.25],
    } as unknown as VoxelCell;
    const pickVoxel = vi.fn().mockReturnValue(cell);
    const viewer = { scene: { pickVoxel } } as unknown as Viewer;
    const controller = {
      primitive,
      layer: {
        id: makeId<VoxelLayer>('temperature-model'),
        isVisible: true,
        opacity: 1,
        mappings: [],
        values: { undefined: -1 },
      },
    } as unknown as VoxelLayerController;
    const windowPosition = new Cartesian2(12, 24);
    const [info] = await new LayerInfoPickerForVoxels(controller, viewer).pick({
      windowPosition,
      globePosition: {
        cartesian: Cartesian3.fromDegrees(8, 47),
        cartographic: Cartographic.fromDegrees(8, 47),
      },
      distance: 20,
    });

    expect(pickVoxel).toHaveBeenCalledWith(windowPosition, 1, 1);
    expect(info.match).toBe('scene');
    expect(info.attributes.map((attribute) => attribute.value)).toEqual([
      11.25,
      '2600000, 1200000, 900',
    ]);
    expect(setUniform).not.toHaveBeenCalled();
    info.select();
    info.select();
    info.deselect();
    info.destroy();
    expect(setUniform.mock.calls).toEqual([
      ['u_selectedTile', 3],
      ['u_selectedSample', 7],
      ['u_selectedTile', -1],
      ['u_selectedSample', -1],
    ]);
  });
});
