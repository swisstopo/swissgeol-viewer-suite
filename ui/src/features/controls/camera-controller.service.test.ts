import { afterEach, describe, expect, it, vi } from 'vitest';
import { Cartesian2, Cartesian3, MouseButton, Ray, Scene } from 'cesium';
import {
  CameraControllerService,
  pickWorldPositionWithDepthBuffer,
} from 'src/features/controls/camera-controller.service';
import { NavigationStyle } from 'src/features/controls/navigation-style.model';

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

describe('CameraControllerService navigation style', () => {
  const create = (cookie = '') => {
    const doc = { cookie };
    vi.stubGlobal('document', doc);
    vi.stubGlobal('location', { protocol: 'http:' });
    return { doc, service: new CameraControllerService() };
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('applies the stored style on construction', () => {
    const { service } = create('swissgeol_navigation_style=modelling');
    expect(service.navigationStyle).toBe(NavigationStyle.Modelling);
    expect(service.panController.dragInputs).toEqual([
      { button: MouseButton.RIGHT },
    ]);
    expect(service.zoomController.dragInputs).toEqual([
      { button: MouseButton.MIDDLE },
    ]);
  });

  it('switches bindings, persists and emits on change', () => {
    const { service, doc } = create();
    const emitted: NavigationStyle[] = [];
    service.navigationStyle$.subscribe((s) => emitted.push(s));

    service.setNavigationStyle(NavigationStyle.Modelling);
    service.setNavigationStyle(NavigationStyle.Modelling);

    expect(emitted).toEqual([NavigationStyle.Esri, NavigationStyle.Modelling]);
    expect(doc.cookie).toContain('swissgeol_navigation_style=modelling');
    expect(service.orbitInputs).toContainEqual({ button: MouseButton.LEFT });
  });

  it('re-attaches active controllers so new inputs take effect', () => {
    const { service } = create();
    const viewer = { addController: vi.fn(), removeController: vi.fn() };
    (service as unknown as { viewer: unknown }).viewer = viewer;
    service.addController(service.panController);
    viewer.addController.mockClear();

    service.setNavigationStyle(NavigationStyle.Modelling);

    expect(viewer.removeController).toHaveBeenCalledWith(service.panController);
    expect(viewer.addController).toHaveBeenCalledWith(service.panController);
    expect(viewer.addController).not.toHaveBeenCalledWith(
      service.zoomController,
    );
  });

  it('does not attach controllers while inputs are disabled', () => {
    const { service } = create();
    const viewer = { addController: vi.fn(), removeController: vi.fn() };
    (service as unknown as { viewer: unknown }).viewer = viewer;
    service.addController(service.panController);
    service.enableInputs = false;
    viewer.addController.mockClear();
    viewer.removeController.mockClear();

    service.setNavigationStyle(NavigationStyle.RightOrbit);

    expect(viewer.addController).not.toHaveBeenCalled();
    expect(viewer.removeController).not.toHaveBeenCalled();
  });
});
