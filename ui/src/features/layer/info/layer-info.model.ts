import { LayerTreeNode } from 'src/layertree';
import { Layer, LayerTiffController } from 'src/features/layer';
import { TemplateResult } from 'lit';
import { Id } from '@swissgeol/ui-core';
import { TranslationKey } from 'src/models/translation-key.model';

/**
 * `LayerInfo` represents the current data of a specific object on a layer.
 * It contains metadata about that object, and is able to highlight it on the viewer.
 */
export interface LayerInfo {
  /**
   * The layer that was picked.
   */
  // TODO Change this to `layerId: Id<Layer>` once everything has been ported to the new layers.
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
  key: string | TranslationKey;
  value: string | number | TemplateResult | TranslationKey;
}

// TODO remove this as soon as everything is ported to the new layers.
export type LayerInfoSource = LayerTreeNode | LayerTiffController | Id<Layer>;
