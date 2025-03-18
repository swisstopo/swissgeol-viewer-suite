import { Drawing } from 'src/features/tool/tool.model';
import { Entity } from 'cesium';

export interface DrawStyleController {
  makeEntity(drawing: Drawing): Entity;
  updateEntity(entity: Entity, drawing: Drawing): Entity;
}
