import { JulianDate } from 'cesium';

export function extractEntitiesAttributes(entity) {
  if (!entity.properties) return;
  return {
    id: entity.id,
    ...entity.properties.getValue(JulianDate.fromDate(new Date())),
  };
}
