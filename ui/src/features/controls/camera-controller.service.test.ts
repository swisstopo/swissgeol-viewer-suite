import { describe, expect, it, vi } from 'vitest';
import { Cartesian2, Cartesian3, Ray, Scene } from 'cesium';
import {
  anchorPickToDrag,
  pickWorldPositionWithDepthBuffer,
} from 'src/features/controls/camera-controller.service';

const TERRAIN = new Cartesian3(1, 2, 3);
const ELLIPSOID = new Cartesian3(9, 9, 9);
const GEOMETRY = new Cartesian3(4, 5, 6);

interface SceneOptions {
  readonly depthPick?: Cartesian3 | undefined;
  readonly globePick?: Cartesian3 | undefined;
  readonly isGlobeShown?: boolean;
}

const createScene = ({
  depthPick,
  globePick,
  isGlobeShown = true,
}: SceneOptions) => {
  const pickEllipsoid = vi.fn(
    (_position: Cartesian2, _ellipsoid: unknown, result: Cartesian3) =>
      Cartesian3.clone(ELLIPSOID, result),
  );
  const globeRayPick = vi.fn(() => globePick);
  const scene = {
    ellipsoid: {},
    globe: {
      show: isGlobeShown,
      pick: globeRayPick,
    },
    camera: {
      pickEllipsoid,
      // Points away from the ellipsoid, so the math-based fallback misses it.
      getPickRay: () =>
        new Ray(new Cartesian3(1e8, 0, 0), Cartesian3.clone(Cartesian3.UNIT_X)),
    },
    pickPosition: vi.fn((_position: Cartesian2, result: Cartesian3) =>
      depthPick === undefined ? undefined : Cartesian3.clone(depthPick, result),
    ),
  };
  return { scene: scene as unknown as Scene, pickEllipsoid, globeRayPick };
};

const pick = (scene: Scene) =>
  pickWorldPositionWithDepthBuffer(
    scene,
    new Cartesian2(10, 20),
    new Cartesian3(),
  );

describe('pickWorldPositionWithDepthBuffer', () => {
  it('prefers the depth buffer when it resolves a position', () => {
    const { scene, globeRayPick, pickEllipsoid } = createScene({
      depthPick: GEOMETRY,
      globePick: TERRAIN,
    });

    expect(pick(scene)).toEqual(GEOMETRY);
    expect(globeRayPick).not.toHaveBeenCalled();
    expect(pickEllipsoid).not.toHaveBeenCalled();
  });

  // Regression: a translucent globe does not write to the depth buffer, so
  // `pickPosition` returns nothing over plain terrain. Falling back to the
  // ellipsoid put the zoom target kilometres below the visible ground, which
  // inflated the measured distance and disabled the approach throttling.
  it('falls back to the terrain ray, not the ellipsoid, without depth', () => {
    const { scene, globeRayPick, pickEllipsoid } = createScene({
      depthPick: undefined,
      globePick: TERRAIN,
    });

    expect(pick(scene)).toEqual(TERRAIN);
    expect(globeRayPick).toHaveBeenCalledOnce();
    expect(pickEllipsoid).not.toHaveBeenCalled();
  });

  it('treats a zeroed depth pick as a miss', () => {
    const { scene, globeRayPick } = createScene({
      depthPick: Cartesian3.ZERO,
      globePick: TERRAIN,
    });

    expect(pick(scene)).toEqual(TERRAIN);
    expect(globeRayPick).toHaveBeenCalledOnce();
  });

  it('falls back to the ellipsoid when the terrain ray misses', () => {
    const { scene, pickEllipsoid } = createScene({
      depthPick: undefined,
      globePick: undefined,
    });

    expect(pick(scene)).toEqual(ELLIPSOID);
    expect(pickEllipsoid).toHaveBeenCalledOnce();
  });

  it('falls back to the ellipsoid when the globe is hidden', () => {
    const { scene, globeRayPick, pickEllipsoid } = createScene({
      depthPick: undefined,
      globePick: TERRAIN,
      isGlobeShown: false,
    });

    expect(pick(scene)).toEqual(ELLIPSOID);
    expect(globeRayPick).not.toHaveBeenCalled();
    expect(pickEllipsoid).toHaveBeenCalledOnce();
  });
});

describe('anchorPickToDrag', () => {
  const scene = {} as Scene;

  const createPick = (...positions: Array<Cartesian3 | undefined>) => {
    let i = 0;
    return vi.fn(
      (_scene: Scene, _windowPosition: Cartesian2, result: Cartesian3) => {
        const position = positions[Math.min(i++, positions.length - 1)];
        return position === undefined
          ? undefined
          : Cartesian3.clone(position, result);
      },
    );
  };

  const pickAt = (anchored: ReturnType<typeof anchorPickToDrag>, x: number) =>
    anchored.pickWorldPosition(scene, new Cartesian2(x, 0), new Cartesian3());

  it('picks once per drag and returns the anchor afterwards', () => {
    const pick = createPick(GEOMETRY, TERRAIN);
    const anchored = anchorPickToDrag(pick);

    expect(pickAt(anchored, 10)).toEqual(GEOMETRY);
    expect(pickAt(anchored, 20)).toEqual(GEOMETRY);
    expect(pickAt(anchored, 30)).toEqual(GEOMETRY);
    expect(pick).toHaveBeenCalledOnce();
  });

  it('picks again after a reset', () => {
    const pick = createPick(GEOMETRY, TERRAIN);
    const anchored = anchorPickToDrag(pick);

    pickAt(anchored, 10);
    anchored.reset();

    expect(pickAt(anchored, 20)).toEqual(TERRAIN);
    expect(pickAt(anchored, 30)).toEqual(TERRAIN);
    expect(pick).toHaveBeenCalledTimes(2);
  });

  it('does not anchor a miss', () => {
    const pick = createPick(undefined, TERRAIN);
    const anchored = anchorPickToDrag(pick);

    expect(pickAt(anchored, 10)).toBeUndefined();
    expect(pickAt(anchored, 20)).toEqual(TERRAIN);
    expect(pickAt(anchored, 30)).toEqual(TERRAIN);
    expect(pick).toHaveBeenCalledTimes(2);
  });

  it('writes into the given result without sharing the anchor', () => {
    const anchored = anchorPickToDrag(createPick(GEOMETRY));
    const result = new Cartesian3();

    expect(anchored.pickWorldPosition(scene, new Cartesian2(), result)).toBe(
      result,
    );

    // The controller may modify the returned position.
    result.x = 1000;
    expect(pickAt(anchored, 10)).toEqual(GEOMETRY);
  });
});
