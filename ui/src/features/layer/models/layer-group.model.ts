import { Layer } from 'src/features/layer/models/layer.model';
import { Model } from 'src/models/model.model';
import { Id } from 'src/models/id.model';

export interface LayerGroup extends Model {
  /**
   * A unique identifier for the group. Will also be used as part of the translation key for the group's display name.
   */
  id: Id<this>;

  /**
   * The group's children.
   */
  children: Array<LayerGroup | Layer>;
}
