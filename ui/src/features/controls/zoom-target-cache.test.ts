import { describe, expect, it, vi } from 'vitest';
import { Cartesian2, Cartesian3, Ray, Scene } from 'cesium';
import { ZoomTargetCache } from './zoom-target-cache';

const CAMERA = new Cartesian3(0, 0, 1000);
const TARGET = new Cartesian3(0, 0, 0);
const TERRAIN = new Cartesian3(0, 0, -10);
const ORIGIN = new Cartesian2(100, 100);
const FRAME_SECONDS = 1 / 60;

/**
 * A scene whose camera sits 1 km above the target. `projected` is where the
 * cached target lands on the canvas, `terrain` what the terrain ray hits.
 */
const createScene = () => {
  const state = {
    projected: Cartesian2.clone(ORIGIN) as Cartesian2 | undefined,
    terrain: Cartesian3.clone(TERRAIN) as Cartesian3 | undefined,
  };
  const scene = {
    camera: {
      positionWC: CAMERA,
      getPickRay: () => new Ray(CAMERA, new Cartesian3(0, 0, -1)),
    },
    globe: { show: true, pick: () => state.terrain },
    cartesianToCanvasCoordinates: (
      _position: Cartesian3,
      result: Cartesian2,
    ) =>
      state.projected === undefined
        ? undefined
        : Cartesian2.clone(state.projected, result),
  };
  return { scene: scene as unknown as Scene, state };
};

const createPick = (...targets: Array<Cartesian3 | undefined>) => {
  let i = 0;
  return vi.fn(
    (_scene: Scene, _windowPosition: Cartesian2, result: Cartesian3) => {
      const target = targets[Math.min(i++, targets.length - 1)];
      return target === undefined
        ? undefined
        : Cartesian3.clone(target, result);
    },
  );
};

describe('ZoomTargetCache', () => {
  const resolve = (
    cache: ZoomTargetCache,
    scene: Scene,
    pick: ReturnType<typeof createPick>,
    frameSeconds = FRAME_SECONDS,
  ) => cache.resolve(scene, ORIGIN, new Cartesian3(), pick, frameSeconds);

  it('reuses the target while it stays under the zoom origin', () => {
    const { scene } = createScene();
    const cache = new ZoomTargetCache();
    const pick = createPick(TARGET);

    expect(resolve(cache, scene, pick)).toEqual(TARGET);
    expect(resolve(cache, scene, pick)).toEqual(TARGET);
    expect(resolve(cache, scene, pick)).toEqual(TARGET);

    expect(pick).toHaveBeenCalledOnce();
    expect(cache.pickCount).toBe(1);
    expect(cache.reuseCount).toBe(2);
  });

  it('picks again once the target has been reused for the maximum age', () => {
    const { scene } = createScene();
    const cache = new ZoomTargetCache();
    const pick = createPick(TARGET);

    resolve(cache, scene, pick, 0.05);
    resolve(cache, scene, pick, 0.05);
    resolve(cache, scene, pick, 0.05);
    expect(pick).toHaveBeenCalledOnce();

    resolve(cache, scene, pick, 0.05);
    expect(pick).toHaveBeenCalledTimes(2);
  });

  it('still reuses every other target at the longest frame duration', () => {
    const { scene } = createScene();
    const cache = new ZoomTargetCache();
    const pick = createPick(TARGET);

    for (let i = 0; i < 6; i++) {
      resolve(cache, scene, pick, 0.1);
    }

    expect(pick).toHaveBeenCalledTimes(3);
    expect(cache.reuseCount).toBe(3);
  });

  it('picks again once the target has left the zoom origin', () => {
    const { scene, state } = createScene();
    const cache = new ZoomTargetCache();
    const pick = createPick(TARGET);

    resolve(cache, scene, pick);
    state.projected = new Cartesian2(ORIGIN.x + 0.4, ORIGIN.y);
    resolve(cache, scene, pick);
    expect(pick).toHaveBeenCalledOnce();

    state.projected = new Cartesian2(ORIGIN.x + 1, ORIGIN.y);
    resolve(cache, scene, pick);
    expect(pick).toHaveBeenCalledTimes(2);
  });

  it('picks again once the target is behind the camera', () => {
    const { scene, state } = createScene();
    const cache = new ZoomTargetCache();
    const pick = createPick(TARGET);

    resolve(cache, scene, pick);
    state.projected = undefined;
    resolve(cache, scene, pick);

    expect(pick).toHaveBeenCalledTimes(2);
  });

  it('tolerates terrain that moves by less than the tolerance', () => {
    const { scene, state } = createScene();
    const cache = new ZoomTargetCache();
    const pick = createPick(TARGET);

    resolve(cache, scene, pick);
    // 1 % of the 1'010 m to the terrain.
    state.terrain = new Cartesian3(0, 0, TERRAIN.z + 10);
    resolve(cache, scene, pick);

    expect(pick).toHaveBeenCalledOnce();
  });

  it('picks again once the terrain under the zoom origin has moved', () => {
    const { scene, state } = createScene();
    const cache = new ZoomTargetCache();
    const pick = createPick(TARGET);

    resolve(cache, scene, pick);
    state.terrain = new Cartesian3(0, 0, TERRAIN.z + 20);
    resolve(cache, scene, pick);

    expect(pick).toHaveBeenCalledTimes(2);
  });

  it('picks again once the terrain ray starts or stops hitting', () => {
    const { scene, state } = createScene();
    const cache = new ZoomTargetCache();
    const pick = createPick(TARGET);

    resolve(cache, scene, pick);
    state.terrain = undefined;
    resolve(cache, scene, pick);
    expect(pick).toHaveBeenCalledTimes(2);

    resolve(cache, scene, pick);
    expect(pick).toHaveBeenCalledTimes(2);

    state.terrain = Cartesian3.clone(TERRAIN);
    resolve(cache, scene, pick);
    expect(pick).toHaveBeenCalledTimes(3);
  });

  it('does not cache a miss', () => {
    const { scene } = createScene();
    const cache = new ZoomTargetCache();
    const pick = createPick(undefined, TARGET);

    expect(resolve(cache, scene, pick)).toBeUndefined();
    expect(resolve(cache, scene, pick)).toEqual(TARGET);
    expect(resolve(cache, scene, pick)).toEqual(TARGET);

    expect(pick).toHaveBeenCalledTimes(2);
  });

  it('picks again after a clear', () => {
    const { scene } = createScene();
    const cache = new ZoomTargetCache();
    const pick = createPick(TARGET);

    resolve(cache, scene, pick);
    cache.clear();
    resolve(cache, scene, pick);

    expect(pick).toHaveBeenCalledTimes(2);
  });

  it('writes into the given result without sharing the cached target', () => {
    const { scene } = createScene();
    const cache = new ZoomTargetCache();
    const pick = createPick(TARGET);
    const result = new Cartesian3();

    resolve(cache, scene, pick);
    expect(cache.resolve(scene, ORIGIN, result, pick, FRAME_SECONDS)).toBe(
      result,
    );

    // CesiumJS may modify the returned position.
    result.z = 1000;
    expect(resolve(cache, scene, pick)).toEqual(TARGET);
  });
});
