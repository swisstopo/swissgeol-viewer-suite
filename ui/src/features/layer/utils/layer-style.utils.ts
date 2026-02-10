import {
  LayerStyle,
  PointLayerStyleValues,
  LineLayerStyleValues,
  PolygonLayerStyleValues,
  LayerStyleGeomType,
  PointVectorOptions,
  LayerStyleValues,
} from 'src/features/layer';
import { PropertyBag, ConstantProperty, JulianDate } from 'cesium';
import { DEFAULT_UPLOADED_GEOJSON_COLOR } from 'src/constants';

function normalizeValue(value: string | number): string | number {
  if (typeof value === 'string') {
    const num = Number(value);

    // Only convert if it is a valid number string
    if (!Number.isNaN(num)) {
      return num;
    }
  }

  return value;
}

export function getStyleForProperty(
  properties: PropertyBag,
  layerStyle: LayerStyle,
  geometryType: 'point',
): PointLayerStyleValues | void;
export function getStyleForProperty(
  properties: PropertyBag,
  layerStyle: LayerStyle,
  geometryType: 'line',
): LineLayerStyleValues | void;
export function getStyleForProperty(
  properties: PropertyBag,
  layerStyle: LayerStyle,
  geometryType: 'polygon',
): PolygonLayerStyleValues | void;
export function getStyleForProperty(
  properties: PropertyBag,
  layerStyle: LayerStyle,
  geometryType: LayerStyleGeomType,
): LayerStyleValues | void {
  const prop = properties[layerStyle.property];
  if (!prop) {
    return;
  }
  const propertyValue =
    prop instanceof ConstantProperty ? prop.getValue(JulianDate.now()) : prop;
  const value = normalizeValue(propertyValue);

  return layerStyle.values.find(
    (v) => v.value === value && v.geomType === geometryType,
  );
}

export function createCanvasForBillboard(
  vectorOptions: PointVectorOptions,
): HTMLCanvasElement | void {
  const shape = vectorOptions.type;
  const radius = vectorOptions.radius || 10;
  const fillColor =
    vectorOptions.fill?.color ??
    DEFAULT_UPLOADED_GEOJSON_COLOR.toCssColorString();
  const strokeColor =
    vectorOptions.stroke?.color ??
    DEFAULT_UPLOADED_GEOJSON_COLOR.toCssColorString();
  const strokeWidth = vectorOptions.stroke?.width ?? 1;

  const canvas = document.createElement('canvas');
  const size = (radius + strokeWidth) * 2;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  context.fillStyle = fillColor;
  context.strokeStyle = strokeColor;
  context.lineWidth = strokeWidth;

  context.beginPath();
  switch (shape) {
    case 'circle':
      context.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
      break;
    case 'square':
      context.rect(
        strokeWidth,
        strokeWidth,
        size - strokeWidth * 2,
        size - strokeWidth * 2,
      );
      break;
    case 'triangle':
      context.moveTo(size / 2, strokeWidth);
      context.lineTo(size - strokeWidth, size - strokeWidth);
      context.lineTo(strokeWidth, size - strokeWidth);
      context.closePath();
      break;
    default:
      context.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
      break;
  }
  context.fill();
  context.stroke();

  return canvas;
}
