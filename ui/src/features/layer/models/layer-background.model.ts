import { BaseLayer, WmtsLayer } from 'src/features/layer';
import { Id, makeId } from 'src/models/id.model';
import { makeModelMapping } from 'src/models/model.model';

/**
 * A {@link Layer} that serves as the viewer's main base layer.
 * Only one such layer will ever exist.
 */
export interface BackgroundLayer extends BaseLayer {
  type: 'Background';

  /**
   * The currently active background variant.
   */
  activeVariantId: Id<BackgroundLayerVariant>;

  /**
   * A mapping of the types of variants that the background can be displayed in.
   */
  variants: ReadonlyMap<Id<BackgroundLayerVariant>, BackgroundLayerVariant>;
}

/**
 * A configuration that defines a theme in which the background can be displayed in.
 */
export interface BackgroundLayerVariant {
  /**
   * The variant's unique id.
   */
  id: Id<BackgroundLayerVariant>;

  /**
   * The WMTS layers that will be rendered.
   */
  children: ReadonlyArray<Id<WmtsLayer>>;

  /**
   * Whether the layer is see-through even when fully visible.
   */
  isTransparent: boolean;
}

const GREY_BACKGROUND: BackgroundLayerVariant = {
  id: makeId('ch.swisstopo.pixelkarte-grau'),
  children: [makeId('ch.swisstopo.pixelkarte-grau')],
  isTransparent: false,
};

const SATELLITE_BACKGROUND: BackgroundLayerVariant = {
  id: makeId('ch.swisstopo.swissimage'),
  children: [makeId('ch.swisstopo.swissimage')],
  isTransparent: false,
};

const WATERS_BACKGROUND: BackgroundLayerVariant = {
  id: makeId('lakes_rivers_map'),
  children: [
    makeId('ch.bafu.vec25-gewaessernetz_2000'),
    makeId('ch.bafu.vec25-seen'),
  ],
  isTransparent: true,
};

const TRANSPARENT_BACKGROUND: BackgroundLayerVariant = {
  id: makeId('transparent'),
  children: [],
  isTransparent: true,
};

const LAYERS = [
  SATELLITE_BACKGROUND,
  GREY_BACKGROUND,
  WATERS_BACKGROUND,
  TRANSPARENT_BACKGROUND,
].map(Object.freeze) as BackgroundLayerVariant[];

export const DEFAULT_BACKGROUND_VARIANT = GREY_BACKGROUND;

export const BACKGROUND_LAYER: BackgroundLayer = {
  type: 'Background' as const,
  id: makeId('background'),
  label: null,
  opacity: 1,
  canUpdateOpacity: true,
  isVisible: false,
  geocatId: null,
  downloadUrl: null,
  legend: null,
  activeVariantId: DEFAULT_BACKGROUND_VARIANT.id,
  variants: makeModelMapping(LAYERS),
  customProperties: {},
};

export const isBackgroundLayer = (value: unknown): value is BackgroundLayer =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  isBackgroundLayerId(value.id);

export const isBackgroundLayerId = (id: unknown): id is Id<BackgroundLayer> =>
  id === BACKGROUND_LAYER.id;
