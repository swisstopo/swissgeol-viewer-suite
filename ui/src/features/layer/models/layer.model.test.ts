import { describe, expect, it } from 'vitest';
import {
  AnyLayer,
  isBasemapLockedLayer,
  is3dLayer,
  LayerType,
  needsBasemapSuppression,
} from 'src/features/layer/models/layer.model';

// Helper to build minimal layer-like objects for the pure classification
// helpers below. Only the fields that the helpers actually inspect are
// required; the rest are irrelevant to the behavior under test.
const makeLayer = (overrides: Record<string, unknown>): AnyLayer =>
  overrides as unknown as AnyLayer;

describe('is3dLayer', () => {
  it('treats Tiles3d, Voxel, and Earthquakes layers as 3D', () => {
    expect(is3dLayer(makeLayer({ type: LayerType.Tiles3d }))).toBe(true);
    expect(is3dLayer(makeLayer({ type: LayerType.Voxel }))).toBe(true);
    expect(is3dLayer(makeLayer({ type: LayerType.Earthquakes }))).toBe(true);
  });

  it('treats a Tiff layer as 3D only when it has its own terrain', () => {
    expect(
      is3dLayer(makeLayer({ type: LayerType.Tiff, terrain: { id: 't' } })),
    ).toBe(true);
    expect(is3dLayer(makeLayer({ type: LayerType.Tiff, terrain: null }))).toBe(
      false,
    );
  });

  it('treats a GeoJson layer as 3D only when it has its own terrain', () => {
    expect(
      is3dLayer(makeLayer({ type: LayerType.GeoJson, terrain: { id: 't' } })),
    ).toBe(true);
    expect(
      is3dLayer(makeLayer({ type: LayerType.GeoJson, terrain: null })),
    ).toBe(false);
  });

  it('treats Wmts and Kml layers as not 3D', () => {
    expect(is3dLayer(makeLayer({ type: LayerType.Wmts }))).toBe(false);
    expect(
      is3dLayer(makeLayer({ type: LayerType.Kml, shouldClampToGround: true })),
    ).toBe(false);
  });
});

describe('isBasemapLockedLayer', () => {
  it('locks Wmts layers', () => {
    expect(isBasemapLockedLayer(makeLayer({ type: LayerType.Wmts }))).toBe(
      true,
    );
  });

  it('locks Tiff and GeoJson layers only without their own terrain', () => {
    expect(
      isBasemapLockedLayer(makeLayer({ type: LayerType.Tiff, terrain: null })),
    ).toBe(true);
    expect(
      isBasemapLockedLayer(
        makeLayer({ type: LayerType.Tiff, terrain: { id: 't' } }),
      ),
    ).toBe(false);
    expect(
      isBasemapLockedLayer(
        makeLayer({ type: LayerType.GeoJson, terrain: null }),
      ),
    ).toBe(true);
    expect(
      isBasemapLockedLayer(
        makeLayer({ type: LayerType.GeoJson, terrain: { id: 't' } }),
      ),
    ).toBe(false);
  });

  it('locks Kml layers only when clamped to ground', () => {
    expect(
      isBasemapLockedLayer(
        makeLayer({ type: LayerType.Kml, shouldClampToGround: true }),
      ),
    ).toBe(true);
    expect(
      isBasemapLockedLayer(
        makeLayer({ type: LayerType.Kml, shouldClampToGround: false }),
      ),
    ).toBe(false);
  });

  it('never locks Tiles3d, Voxel, or Earthquakes layers', () => {
    expect(isBasemapLockedLayer(makeLayer({ type: LayerType.Tiles3d }))).toBe(
      false,
    );
    expect(isBasemapLockedLayer(makeLayer({ type: LayerType.Voxel }))).toBe(
      false,
    );
    expect(
      isBasemapLockedLayer(makeLayer({ type: LayerType.Earthquakes })),
    ).toBe(false);
  });
});

describe('needsBasemapSuppression', () => {
  it('requires suppression for a GeoJson layer without its own terrain', () => {
    expect(
      needsBasemapSuppression(
        makeLayer({ type: LayerType.GeoJson, terrain: null }),
      ),
    ).toBe(true);
    expect(
      needsBasemapSuppression(
        makeLayer({ type: LayerType.GeoJson, terrain: { id: 't' } }),
      ),
    ).toBe(false);
  });

  it('requires suppression for a clamped Kml layer only', () => {
    expect(
      needsBasemapSuppression(
        makeLayer({ type: LayerType.Kml, shouldClampToGround: true }),
      ),
    ).toBe(true);
    expect(
      needsBasemapSuppression(
        makeLayer({ type: LayerType.Kml, shouldClampToGround: false }),
      ),
    ).toBe(false);
  });

  it('never requires suppression for Tiff layers (they disappear with the globe)', () => {
    expect(
      needsBasemapSuppression(
        makeLayer({ type: LayerType.Tiff, terrain: null }),
      ),
    ).toBe(false);
    expect(
      needsBasemapSuppression(
        makeLayer({ type: LayerType.Tiff, terrain: { id: 't' } }),
      ),
    ).toBe(false);
  });

  it('never requires suppression for Wmts, Tiles3d, Voxel, or Earthquakes layers', () => {
    expect(needsBasemapSuppression(makeLayer({ type: LayerType.Wmts }))).toBe(
      false,
    );
    expect(
      needsBasemapSuppression(makeLayer({ type: LayerType.Tiles3d })),
    ).toBe(false);
    expect(needsBasemapSuppression(makeLayer({ type: LayerType.Voxel }))).toBe(
      false,
    );
    expect(
      needsBasemapSuppression(makeLayer({ type: LayerType.Earthquakes })),
    ).toBe(false);
  });
});
