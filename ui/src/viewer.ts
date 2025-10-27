import { SWITZERLAND_RECTANGLE } from './constants';

import NavigableVolumeLimiter from './NavigableVolumeLimiter';
import KeyboardNavigation from './KeyboardNavigation.js';

import {
  Cartesian3,
  CesiumInspector,
  CesiumTerrainProvider,
  Color,
  DirectionalLight,
  ImageryLayer,
  Ion,
  IonResource,
  JulianDate,
  Rectangle,
  RequestScheduler,
  ScreenSpaceEventType,
  SunLight,
  Viewer,
  WebGLOptions,
} from 'cesium';
import { getExaggeration } from './permalink';

window['CESIUM_BASE_URL'] = './cesium';

Ion.defaultAccessToken =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YjNhNmQ4My01OTdlLTRjNmQtYTllYS1lMjM0NmYxZTU5ZmUiLCJpZCI6MTg3NTIsInNjb3BlcyI6WyJhc2wiLCJhc3IiLCJhc3ciLCJnYyJdLCJpYXQiOjE1NzQ0MTAwNzV9.Cj3sxjA_x--bN6VATcN4KE9jBJNMftlzPuA8hawuZkY';

Object.assign(RequestScheduler.requestsByServer, {
  'wmts.geo.admin.ch:443': 18,
  'wms0.geo.admin.ch:443': 9,
  'wms1.geo.admin.ch:443': 9,
  'wms2.geo.admin.ch:443': 9,
  'wms3.geo.admin.ch:443': 9,
  'vectortiles0.geo.admin.ch:443': 18,
});

let hasNoLimit = false;

interface EmptyLayer {
  layer: { show: boolean };
}

export interface BaseLayerConfig {
  id: string;
  labelKey: string;
  backgroundImgSrc: string;
  layers?: ImageryLayer[] | EmptyLayer[];
  default?: boolean;
  hasAlphaChannel?: boolean;
}

export async function setupViewer(
  container: Element,
  rethrowRenderErrors: boolean,
) {
  const searchParams = new URLSearchParams(location.search);

  const zExaggeration = getExaggeration();
  if (searchParams.get('noLimit') === 'true') {
    hasNoLimit = true;
  }

  let terrainUrl;
  const ownTerrain = searchParams.get('ownterrain');
  switch (ownTerrain) {
    case 'false':
      terrainUrl = IonResource.fromAssetId(1);
      break;
    case 'cli_ticino_0.5m':
      terrainUrl = 'https://download.swissgeol.ch/cli_terrain/ticino-0.5m/';
      break;
    case 'cli_walensee_0.5m':
      terrainUrl = 'https://download.swissgeol.ch/cli_terrain/walensee-0.5m/';
      break;
    case 'cli_terrain_ch-2m':
      terrainUrl = 'https://download.swissgeol.ch/cli_terrain/ch-2m/';
      break;
    default:
      terrainUrl = 'https://3d.geo.admin.ch/ch.swisstopo.terrain.3d/v1/';
  }

  const shouldRequestRenderMode = !searchParams.has('norequestrendermode');
  const terrainProvider = searchParams.has('noterrain')
    ? undefined
    : await CesiumTerrainProvider.fromUrl(terrainUrl);

  const webgl: WebGLOptions = {
    powerPreference: 'high-performance',
  };
  const contextOptions = {
    webgl,
  };
  const viewer = new Viewer(container, {
    contextOptions: contextOptions,
    showRenderLoopErrors: rethrowRenderErrors,
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    vrButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,
    navigationInstructionsInitiallyVisible: false,
    scene3DOnly: true,
    skyBox: false,
    baseLayer: false,
    useBrowserRecommendedResolution: true,
    terrainProvider,
    requestRenderMode: shouldRequestRenderMode,
    // maximumRenderTimeChange: 10,
  });

  const scene = viewer.scene;

  // Hide underground fog.
  scene.fog.enabled = false;
  scene.globe.showGroundAtmosphere = false;

  scene.rethrowRenderErrors = rethrowRenderErrors;
  // remove the default behaviour of calling 'zoomTo' on the double clicked entity
  viewer.screenSpaceEventHandler.removeInputAction(
    ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
  );
  const globe = scene.globe;
  scene.verticalExaggeration = zExaggeration;

  if (searchParams.get('swissrectangle') !== 'false') {
    const rectangle = Rectangle.fromDegrees(
      5.86725126512748,
      45.8026860136571,
      10.9209100671547,
      47.8661652478939,
    );
    globe.cartographicLimitRectangle = rectangle;
  }

  // Position the sun the that shadows look nice
  let sunDate = new Date('2018-06-21T10:00:00.000Z');
  if (searchParams.has('date')) {
    const betterDate = new Date(searchParams.get('date') ?? '');
    if (Number.isNaN(betterDate.getDate())) {
      console.error(`Provided date is wrong: ${searchParams.get('date')}`);
    } else {
      sunDate = betterDate;
    }
  }
  viewer.clock.currentTime = JulianDate.fromDate(sunDate);

  if (searchParams.has('light')) {
    const p = searchParams.get('light')?.split('-').map(parseFloat) as number[];
    scene.light = new DirectionalLight({
      direction: new Cartesian3(p[0], p[1], p[2]),
      color: Color.WHITE,
      intensity: p[3],
    });
  } else {
    // Use sun lighting above ground
    const sunLight = new SunLight();
    // Define a flashlight for viewing underground
    const flashlight = new DirectionalLight({
      direction: scene.camera.directionWC,
    });
    scene.preRender.addEventListener((scene) => {
      if (scene.cameraUnderground) {
        flashlight.direction = Cartesian3.clone(
          scene.camera.directionWC,
          flashlight.direction,
        );
        scene.light = flashlight;
      } else {
        scene.light = sunLight;
      }
    });
  }

  // Limit the volume inside which the user can navigate
  if (!hasNoLimit) {
    new NavigableVolumeLimiter(scene, SWITZERLAND_RECTANGLE, 193, (height) =>
      height > 3000 ? 9 : 3,
    );
  }

  new KeyboardNavigation(viewer.scene);

  scene.screenSpaceCameraController.enableCollisionDetection = false;
  scene.useDepthPicking = true;
  scene.pickTranslucentDepth = true; // required to have accurate position when picking translucent objects
  scene.backgroundColor = Color.TRANSPARENT;
  globe.baseColor = Color.TRANSPARENT;
  globe.depthTestAgainstTerrain = true;
  globe.showGroundAtmosphere = false;
  globe.showWaterEffect = false;
  globe.backFaceCulling = false;
  globe.undergroundColor = Color.BLACK;
  globe.undergroundColorAlphaByDistance.nearValue = 0.5;
  globe.undergroundColorAlphaByDistance.farValue = 0.0;

  const shouldEnableWireframe = searchParams.has('inspector_wireframe');
  if (searchParams.has('inspector') || shouldEnableWireframe) {
    const div = document.createElement('div');
    div.id = 'divinspector';
    document.body.appendChild(div);
    const inspector = new CesiumInspector('divinspector', scene);
    window['cesiumInspector'] = inspector;
    if (shouldEnableWireframe) {
      inspector.viewModel.wireframe = true;
    }
  }
  return viewer;
}
