import { LayerTreeNode } from 'src/layertree';
import { LayerTiffController } from 'src/features/layer';

/**
 * `LayerInfo` represents the current data of a specific object on a layer.
 * It contains metadata about that object, and is able to highlight it on the viewer.
 */
export interface LayerInfo {
  /**
   * The layer that was picked.
   */
  source: LayerInfoSource;

  /**
   * The (translated) name of the picked object.
   */
  title: string;

  /**
   * The picked object's attributes.
   */
  attributes: LayerInfoAttribute[];

  /**
   * Zooms to the picked object.
   */
  zoomToObject(): void;

  /**
   * Highlights the picked object.
   */
  activateHighlight(): void;

  /**
   * Disables the highlight on the picked object.
   */
  deactivateHighlight(): void;

  /**
   * Destroys any highlights and other helper entities, effectively removing it from the viewer.
   * This is called when the info object is no longer needed.
   */
  destroy(): void;
}

export interface LayerInfoAttribute {
  key: string;
  value: string | number;
}

export type LayerInfoSource = LayerTreeNode | LayerTiffController;
