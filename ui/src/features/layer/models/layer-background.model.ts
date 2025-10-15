import { BaseLayer, SwisstopoLayer } from 'src/features/layer';

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
  children: SwisstopoLayer[];

  /**
   * Whether the {@link imagePath the base image} has an alpha channel.
   */
  hasAlphaChannel: boolean;
}
