import { BaseLayer, SwisstopoLayer } from 'src/features/layer';
import { makeId } from 'src/models/id.model';

/**
 * A {@link Layer} that serves as the viewer's main base layer.
 * Only one such layer will be active at a time.
 */
export interface BackgroundLayer extends BaseLayer {
  type: 'Background';

  /**
   * The url path at which the layer's image can be found.
   */
  imagePath: string;

  /**
   * The layer's sub layers, consisting of images that will be layered on top of {@link imagePath the base image}.
   * Unlike the base image, these images will be fetched from swisstopo instead of being local files.
   */
  children: Array<
    Omit<
      SwisstopoLayer,
      Exclude<keyof BaseLayer, 'id'> | 'dimension' | 'source' | 'credit'
    >
  >;

  /**
   * Whether the {@link imagePath the base image} has an alpha channel.
   */
  hasAlphaChannel: boolean;
}

const sharedProperties = {
  type: 'Background',
  opacity: 1,
  canUpdateOpacity: true,
  isVisible: true,
  label: null,
  legend: null,
  downloadUrl: null,
  geocatId: null,
} satisfies Partial<BackgroundLayer>;

const SATELLITE_BACKGROUND: BackgroundLayer = {
  ...sharedProperties,
  id: makeId('ch.swisstopo.pixelkarte-grau'),
  imagePath: '/images/arealimage.png',
  hasAlphaChannel: false,
  children: [
    {
      id: makeId('ch.swisstopo.swissimage'),
      format: 'jpeg',
      maxLevel: 20,
    },
  ],
};

const GREY_BACKGROUND: BackgroundLayer = {
  ...sharedProperties,
  id: makeId('ch.swisstopo.pixelkarte-grau'),
  imagePath: '/images/grey.png',
  hasAlphaChannel: false,
  children: [
    {
      id: makeId('ch.swisstopo.pixelkarte-grau'),
      format: 'jpeg',
      maxLevel: 18,
    },
  ],
};

const WATERS_BACKGROUND: BackgroundLayer = {
  ...sharedProperties,
  id: makeId('lakes_rivers_map'),
  imagePath: '/images/lakes_rivers.png',
  hasAlphaChannel: true,
  children: [
    {
      id: makeId('ch.bafu.vec25-seen'),
      format: 'png',
      maxLevel: 18,
    },
    {
      id: makeId('ch.bafu.vec25-gewaessernetz_2000'),
      format: 'png',
      maxLevel: 18,
    },
  ],
};

export const BACKGROUND_LAYERS = [
  SATELLITE_BACKGROUND,
  GREY_BACKGROUND,
  WATERS_BACKGROUND,
] as const;
