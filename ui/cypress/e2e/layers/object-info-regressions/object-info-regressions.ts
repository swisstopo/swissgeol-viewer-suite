import {
  Given,
  Then,
  When,
  Before,
} from '@badeball/cypress-cucumber-preprocessor';

const GEOJSON_ID = 'e2e-info-geojson';
const WMTS_ID = 'e2e-info-wmts';
let selectedEntity: any;
let releaseFrench: (() => void) | undefined;

// Wrap the element so Cypress does not turn the returned DOM node into jQuery.
const app = () =>
  cy.get('ngm-app').then(($app) => ({ element: $app[0] as any }));
const layerItem = () =>
  cy.get(`li[data-id="${GEOJSON_ID}"] ngm-catalog-display-list-item`);
const canvas = () => cy.get('.cesium-widget > canvas').first();

const renderFrame = () =>
  app().then(({ element }) => {
    const scene = element.cesiumService.viewer.scene;
    return new Cypress.Promise<void>((resolve) => {
      const remove = scene.postRender.addEventListener(() => {
        remove();
        resolve();
      });
      scene.requestRender();
    });
  });

const screenshotRenderedViewer = (name: string) => {
  renderFrame();
  cy.get('ngm-app', { timeout: 30_000 }).should(($app) => {
    expect(($app[0] as any).cesiumService.viewer.dataSourceDisplay.ready).to.eq(
      true,
    );
  });
  renderFrame();
  cy.screenshot(name, { capture: 'viewport', scale: true });
};

const chooseLanguage = (language: string) => {
  cy.get('ngm-layout-language-selector').shadow().find('.title').click();
  cy.get('ngm-layout-language-selector')
    .shadow()
    .contains('.menu > .item', language)
    .click();
};

const showGeoJson = () => {
  const x = 7.44;
  const y = 46.95;
  cy.intercept('GET', '**/e2e/object-info.geojson', {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          name: 'Regression polygon',
          fill: '#0000ff',
          'fill-opacity': 1,
          stroke: '#0000ff',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [x - 0.004, y - 0.004],
              [x + 0.004, y - 0.004],
              [x + 0.004, y + 0.004],
              [x - 0.004, y + 0.004],
              [x - 0.004, y - 0.004],
            ],
          ],
        },
      },
    ],
  });
  app().then(({ element }) => {
    element.layerService.activateCustomLayer({
      id: GEOJSON_ID,
      type: 'GeoJson',
      label: 'Regression polygon',
      source: {
        type: 'Url',
        url: 'http://localhost:8000/e2e/object-info.geojson',
      },
      terrain: null,
      shouldClampToGround: true,
      canUpdateOpacity: true,
      opacity: 1,
      isVisible: true,
      geocatId: null,
      downloadUrl: null,
      infoBox: null,
      customProperties: {},
      orderOfProperties: [],
      layerStyle: null,
      isLocal: true,
    });
    const viewer = element.cesiumService.viewer;
    viewer.camera.setView({
      destination: viewer.camera.position.constructor.fromDegrees(
        7.44,
        46.95,
        4000,
      ),
      orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
    });
    viewer.scene.requestRender();
  });
  layerItem().should('be.visible');
};

Before(() => {
  cy.viewport(1280, 720);
  selectedEntity = undefined;
  releaseFrench = undefined;
});

Given('a blue GeoJSON regression polygon is displayed', () => {
  showGeoJson();
  cy.get('ngm-app', { timeout: 30_000 }).should(($app) => {
    const element = $app[0] as any;
    const viewer = element.cesiumService.viewer;
    const hit = viewer.scene.pick({
      x: viewer.canvas.clientWidth / 2,
      y: viewer.canvas.clientHeight / 2,
    });
    expect(hit?.id?.polygon, 'rendered polygon at the actual canvas click').to
      .exist;
    expect(
      element.layerService.controller(GEOJSON_ID).ownsSceneObject(hit.id),
    ).to.eq(true);
    selectedEntity = hit.id;
  });
});

When('the regression polygon is clicked on the map', () => {
  canvas().click('center');
  cy.get('ngm-layer-info-list').should('be.visible');
  cy.get('ngm-layer-info-item')
    .shadow()
    .should('contain.text', 'Regression polygon');
});

Then('the regression polygon is highlighted', () => {
  cy.then(() => {
    const color = selectedEntity.polygon.material.getValue().color;
    expect(color.green).to.eq(1);
    expect(color.red).to.be.closeTo(179 / 255, 0.001);
    expect(color.blue).to.be.closeTo(48 / 255, 0.001);
  });
  screenshotRenderedViewer('object-info-highlight-before-opacity');
});

When('its opacity is changed to thirty percent using the slider', () => {
  layerItem().shadow().find('[data-cy="opacity"]').click();
  layerItem()
    .shadow()
    .find('ngm-core-slider')
    .shadow()
    .find('input[type="range"]')
    .invoke('val', 0.3)
    .trigger('input')
    .trigger('change');
  layerItem()
    .shadow()
    .find('[data-cy="opacity"]')
    .should('contain.text', '30%');
});

When('the object info window is closed', () => {
  cy.get('ngm-core-window').shadow().find('.title ngm-core-button').click();
  cy.get('ngm-layer-info-list').should('not.exist');
});

Then('the polygon has its blue base color and thirty percent opacity', () => {
  cy.then(() => {
    const color = selectedEntity.polygon.material.getValue().color;
    expect(color.red).to.eq(0);
    expect(color.green).to.eq(0);
    expect(color.blue).to.eq(1);
    expect(color.alpha).to.be.closeTo(0.3, 0.001);
  });
  screenshotRenderedViewer('object-info-base-color-after-opacity');
});

Given(
  'a localized info layer and another regression layer are displayed',
  () => {
    cy.intercept('GET', 'https://api3.geo.admin.ch/**/identify*', (req) => {
      const coordinates = String(req.query.geometry).split(',').map(Number);
      const layerId = String(req.query.layers).replace(/^all:/, '');
      req.reply({
        results: [
          {
            layerBodId: layerId,
            featureId: 1,
            geometry: { type: 'Point', coordinates },
            properties: { label: 'Localized regression sample' },
          },
        ],
      });
    });
    cy.intercept(
      'GET',
      /https:\/\/api3\.geo\.admin\.ch\/.*\/e2e-info-(wmts|geojson)\/1\/htmlPopup/,
      (req) => {
        const isPrimary = req.url.includes(`/${WMTS_ID}/`);
        const isFrench = req.query.lang === 'fr';
        const value = isPrimary
          ? isFrench
            ? 'Français'
            : 'Deutsch'
          : 'Secondary sample';
        const reply = () =>
          req.reply({
            headers: { 'content-type': 'text/html' },
            body: `<div class="htmlpopup-content"><table><tr><td>Name</td><td>${value}</td></tr></table></div>`,
          });
        if (isPrimary && isFrench) {
          return new Cypress.Promise<void>((resolve) => {
            releaseFrench = () => {
              reply();
              resolve();
            };
          });
        }
        reply();
      },
    );
    app().then(({ element }) => {
      const layer = {
        id: WMTS_ID,
        type: 'Wmts',
        label: 'Localized regression layer',
        source: 'WMS',
        serviceUrl: null,
        service: null,
        maxLevel: 18,
        times: null,
        format: 'image/png',
        credit: '',
        ogcSource: null,
        opacity: 1,
        canUpdateOpacity: true,
        isVisible: true,
        geocatId: null,
        downloadUrl: null,
        infoBox: null,
        customProperties: {},
        isLocal: true,
      };
      element.layerService.activateCustomLayer({
        ...layer,
        id: GEOJSON_ID,
        label: 'Other regression layer',
      });
      element.layerService.activateCustomLayer(layer);
      const viewer = element.cesiumService.viewer;
      viewer.camera.setView({
        destination: viewer.camera.position.constructor.fromDegrees(
          7.44,
          46.95,
          4000,
        ),
        orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
      });
      viewer.scene.requestRender();
    });
    layerItem().should('be.visible');
  },
);

When('the info layer is queried in German', () => {
  chooseLanguage('DE');
  canvas().click('center');
  cy.get('ngm-layer-info-item').shadow().should('contain.text', 'Deutsch');
  cy.get('ngm-layer-info-list')
    .shadow()
    .find('[data-tab="samePosition"] .badge')
    .should('contain.text', '1');
});

When('French is selected while its attribute response is held', () => {
  chooseLanguage('FR');
  cy.wrap(null).should(() =>
    expect(releaseFrench, 'French refresh in flight').to.be.a('function'),
  );
});

When('the other regression layer is hidden using its eye button', () => {
  layerItem().shadow().find('[data-cy="visibility"]').click();
  layerItem().should('not.have.attr', 'visible');
});

When('the French attribute response is released', () => {
  cy.then(() => releaseFrench!());
});

Then('the info window displays the French attributes', () => {
  cy.get('ngm-layer-info-item').shadow().should('contain.text', 'Français');
  cy.get('ngm-layer-info-item').shadow().should('not.contain.text', 'Deutsch');
  screenshotRenderedViewer('object-info-french-after-layer-hidden');
});
