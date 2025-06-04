import type { UrlTemplateImageryProvider } from 'cesium';

export const ORTHOGRAPHIC_LAYER = 'ch.swisstopo.swissimage';
export const TOPOGRAPHIC_LAYER = 'ch.swisstopo.pixelkarte-grau';
export const LAKES_AND_RIVERS_LAYER = 'lakes_rivers_map';

export const hasViewerBackground = (layer: string) => {
  cy.get('ngm-app').then((el) => {
    const provider = (el[0] as any).viewer.scene.imageryLayers.get(
      0,
    )?.imageryProvider;
    expect(Object.getPrototypeOf(provider).constructor.name).to.be.equal(
      'UrlTemplateImageryProvider',
    );
    const urlProvider = provider as UrlTemplateImageryProvider;

    const [expectedLayerName, expectedFormat] =
      layer === LAKES_AND_RIVERS_LAYER
        ? ['ch.bafu.vec25-gewaessernetz_2000', 'png']
        : [layer, 'jpeg'];

    expect(urlProvider.url).to.be.equal(
      `https://wmts.geo.admin.ch/1.0.0/${expectedLayerName}/default/current/3857/{z}/{x}/{y}.${expectedFormat}`,
    );
  });
};

export const getLayerList = () => cy.get('ngm-layer-display-list');

export const getBackgroundLayerItem = () =>
  getLayerList().shadow().find('ngm-layer-display-list-item:last-child');

export const getBackgroundButton = () =>
  getBackgroundLayerItem().shadow().get('[data-cy="background"]');

export const getBackgroundSelect = () =>
  getBackgroundLayerItem().shadow().find('ngm-background-layer-select');

export const getBackgroundSelector = (layer: string) =>
  getBackgroundSelect().shadow().find(`[data-layer="${layer}"]`);
