import { Entity } from 'cesium';
import { LayerTreeNode } from 'src/layertree';

/**
 * `LayerInfo` represents the current data of a specific object on a layer.
 * It contains metadata about that object, and is able to highlight it on the viewer.
 */
export interface LayerInfo {
  /**
   * The entity that represents the picked object.
   */
  entity: Entity;

  /**
   * The layer that was picked.
   */
  layer: LayerTreeNode;

  /**
   * The (translated) name of the picked object.
   */
  title: string;

  /**
   * The picked object's attributes.
   */
  attributes: LayerInfoAttribute[];

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
