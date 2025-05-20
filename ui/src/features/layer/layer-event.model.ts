import { LayerConfig } from 'src/layertree';

export type LayerEvent = CustomEvent<LayerEventDetail>;
export interface LayerEventDetail {
  layer: LayerConfig;
}

export type LayerReorderEvent = CustomEvent<LayerReorderEventDetail>;
export interface LayerReorderEventDetail extends LayerEventDetail {
  oldIndex: number;
  newIndex: number;
}

export type LayersEvent = CustomEvent<LayersEventDetail>;
export interface LayersEventDetail {
  layers: LayerConfig[];
}
