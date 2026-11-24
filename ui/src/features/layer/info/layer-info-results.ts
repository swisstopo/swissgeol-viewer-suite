import type { Layer } from 'src/features/layer/models/layer.model';
import type { Id } from 'src/models/id.model';
import type { LayerInfo } from './layer-info.model';

const matchPriority = {
  scene: 0,
  direct: 1,
  nearby: 2,
};

export const sortLayerInfos = (
  infos: readonly LayerInfo[],
  displayedLayerIds: readonly Id<Layer>[],
): LayerInfo[] => {
  const layerPositions = new Map(displayedLayerIds.map((id, i) => [id, i]));
  const layerPosition = (info: LayerInfo) =>
    layerPositions.get(info.layerId) ?? displayedLayerIds.length;

  return [...infos].sort(
    (a, b) =>
      matchPriority[a.match ?? 'direct'] - matchPriority[b.match ?? 'direct'] ||
      layerPosition(a) - layerPosition(b),
  );
};

export const getPrimaryInfo = (infos: readonly LayerInfo[]): LayerInfo | null =>
  infos.find((info) => info.match !== 'nearby') ?? null;

export const splitLayerInfos = (infos: readonly LayerInfo[]) => {
  const exact = getPrimaryInfo(infos);
  return {
    exact,
    samePosition: infos.filter(
      (info) => info !== exact && info.match !== 'nearby',
    ),
    nearby: infos.filter((info) => info.match === 'nearby'),
  };
};
