import { Geometry } from 'src/features/tool/tool.model';
import { Entity } from 'cesium';

export interface DrawStyleController {
  makeEntity(geometry: Geometry): Entity;
  updateEntity(entity: Entity, geometry: Geometry): Entity;
}
