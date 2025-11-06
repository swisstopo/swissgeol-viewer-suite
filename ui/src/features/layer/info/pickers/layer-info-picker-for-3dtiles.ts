import {
  LayerInfoPicker,
  LayerPickData,
} from 'src/features/layer/info/pickers/layer-info-picker';
import { LayerInfo, LayerInfoAttribute } from '../layer-info.model';
import { LayerTreeNode } from 'src/layertree';
import {
  BoundingSphere,
  Cartesian3,
  Cesium3DTileFeature,
  Color,
  ColorMaterialProperty,
  Entity,
  HeadingPitchRange,
  JulianDate,
  Viewer,
} from 'cesium';
import {
  DRILL_PICK_LENGTH,
  DRILL_PICK_LIMIT,
  GEOMETRY_DATASOURCE_NAME,
  NO_EDIT_GEOMETRY_DATASOURCE_NAME,
  OBJECT_HIGHLIGHT_COLOR,
  OBJECT_ZOOMTO_RADIUS,
} from 'src/constants';
import NavToolsStore from 'src/store/navTools';
import { TemplateResult } from 'lit';
import { PickableCesium3DTileset } from 'src/layers/helpers';

const PROPERTIES_TO_EXCLUDE = [
  'propsOrder',
  'color_blue',
  'color_green',
  'color_red',
  'model_feature',
  'm_alias',
  'oname',
  'style_transparency',
];

export class LayerInfoPickerFor3dTiles implements LayerInfoPicker {
  constructor(
    private readonly layer: LayerTreeNode,
    private readonly viewer: Viewer,
  ) {}

  get source(): LayerTreeNode {
    return this.layer;
  }

  async pick(pick: LayerPickData): Promise<LayerInfo[]> {
    const feature = this.pickByDrill(pick);
    if (feature === null) {
      return [];
    }
    // TODO: This is a workaround due to missing types in CesiumJS. Refactor once they are exposed.
    if (
      !(feature instanceof Cesium3DTileFeature) &&
      (feature as any).content?._tileset?.customProperties
    ) {
      return this.pickFeatureForNewTileset(
        pick,
        (feature as any).content._tileset as PickableCesium3DTileset,
      );
    }
    if (feature instanceof Cesium3DTileFeature) {
      return this.pickFeatureForOldTileset(pick, feature);
    }
    if (
      typeof feature === 'object' &&
      'primitive' in feature &&
      'id' in feature &&
      feature.id instanceof Entity
    ) {
      return this.pickEntity(feature.id, feature.primitive as object);
    }
    console.warn(
      `Picked unsupported object on layer '${this.layer.layer}'. It will be ignored.`,
      feature,
    );
    return [];
  }

  destroy(): void {}

  private pickFeatureForNewTileset(
    pick: LayerPickData,
    tileset: PickableCesium3DTileset,
  ) {
    if (!tileset.pickable) {
      return [];
    }

    const attributes: LayerInfoAttribute[] = extractTilesetAttributes(tileset);

    return [
      new LayerInfoFor3dTile(this.viewer, {
        feature: tileset,
        position: pick.cartesian,
        attributes,
        source: this.source,
        title: this.layer.label,
      }),
    ];
  }

  private pickFeatureForOldTileset(
    pick: LayerPickData,
    feature: Cesium3DTileFeature,
  ): LayerInfo[] {
    if (!feature.tileset['pickable']) {
      return [];
    }
    const attributes = extractFeatureAttributes(feature);
    return [
      new LayerInfoFor3dTile(this.viewer, {
        feature,
        position: pick.cartesian,
        attributes,
        source: this.source,
        title: this.layer.label,
      }),
    ];
  }

  private pickEntity(entity: Entity, primitive: object): LayerInfo[] {
    if (!primitive['allowPicking']) {
      return [];
    }

    const attributes = extractEntityAttributes(this.viewer, entity);
    if (attributes.length === 0) {
      return [];
    }
    return [
      new LayerInfoForEntity(this.viewer, {
        entity,
        attributes,
        source: this.source,
        title: this.layer.label,
      }),
    ];
  }

  private pickByDrill(pick: LayerPickData): unknown | null {
    const windowPosition = this.viewer.scene.cartesianToCanvasCoordinates(
      pick.cartesian,
    );
    if (windowPosition === undefined) {
      return null;
    }

    const objects = this.viewer.scene.drillPick(
      windowPosition,
      DRILL_PICK_LIMIT,
      DRILL_PICK_LENGTH,
      DRILL_PICK_LENGTH,
    );
    if (objects.length === 0) {
      return null;
    }

    const slicerDataSource = this.viewer.dataSources.getByName('slicer')[0];
    if (slicerDataSource === undefined) {
      return null;
    }

    const first = objects[0];
    if (first.id == null || !slicerDataSource.entities.contains(first.id)) {
      return first;
    }

    // Selects second object if first is entity related to slicing box and next is not related to slicing box.
    const second = objects[1];
    if (second?.id != null && !slicerDataSource.entities.contains(second.id)) {
      return second;
    }

    return null;
  }
}

class LayerInfoFor3dTile implements LayerInfo {
  public readonly source: LayerTreeNode;
  public readonly title: string;
  public readonly attributes: LayerInfoAttribute[];

  private readonly feature: Cesium3DTileFeature | PickableCesium3DTileset;
  private readonly position: Cartesian3;

  constructor(
    private readonly viewer: Viewer,
    data: Pick<LayerInfo, 'source' | 'title' | 'attributes'> & {
      feature: Cesium3DTileFeature | PickableCesium3DTileset;
      source: LayerTreeNode;
      position: Cartesian3;
    },
  ) {
    this.feature = data.feature;
    this.position = data.position;
    this.source = data.source;
    this.title = data.title;
    this.attributes = data.attributes;

    if (this.feature instanceof Cesium3DTileFeature) {
      this.feature.tileset.customShader!.setUniform('u_is_highlighted', true);
    } else {
      this.feature.customShader!.setUniform('u_is_highlighted', true);
    }
  }

  zoomToObject(): void {
    NavToolsStore.hideTargetPoint();
    const boundingSphere = new BoundingSphere(
      this.position,
      OBJECT_ZOOMTO_RADIUS,
    );
    const zoomHeadingPitchRange = new HeadingPitchRange(
      0,
      Math.PI / 8,
      boundingSphere.radius,
    );
    this.viewer.scene.camera.flyToBoundingSphere(boundingSphere, {
      duration: 0,
      offset: zoomHeadingPitchRange,
    });
  }

  activateHighlight() {}

  deactivateHighlight() {}

  destroy() {
    if (this.feature instanceof Cesium3DTileFeature) {
      this.feature.tileset.customShader!.setUniform('u_is_highlighted', false);
    } else {
      this.feature.customShader!.setUniform('u_is_highlighted', false);
    }
  }
}

class LayerInfoForEntity implements LayerInfo {
  public readonly source: LayerTreeNode;
  public readonly title: string;
  public readonly attributes: LayerInfoAttribute[];

  private readonly entity: Entity;
  private readonly geometry: { material: ColorMaterialProperty } | null;

  private readonly originalColor: Color;

  constructor(
    private readonly viewer: Viewer,
    data: Pick<LayerInfo, 'source' | 'title' | 'attributes'> & {
      entity: Entity;
      source: LayerTreeNode;
    },
  ) {
    this.entity = data.entity;
    this.source = data.source;
    this.title = data.title;
    this.attributes = data.attributes;

    this.geometry = this.findGeometry();
    if (this.geometry !== null) {
      this.originalColor = Color.clone(
        this.geometry.material.getValue(JulianDate.now()).color,
      );
      this.geometry!.material = new ColorMaterialProperty(
        OBJECT_HIGHLIGHT_COLOR.withAlpha(this.originalColor!.alpha),
      );
    } else {
      this.originalColor = Color.TRANSPARENT;
    }
  }

  private findGeometry(): { material: ColorMaterialProperty } | null {
    for (const value of Object.values(this.entity)) {
      if (
        value !== null &&
        typeof value === 'object' &&
        'material' in value &&
        value.material instanceof ColorMaterialProperty
      ) {
        return value;
      }
    }
    return null;
  }

  zoomToObject(): void {
    const props = this.entity.properties?.getValue(JulianDate.now());
    this.viewer.zoomTo(this.entity, props?.zoomHeadingPitchRange);
  }

  activateHighlight() {}

  deactivateHighlight() {}

  destroy() {
    if (this.geometry === null) {
      return;
    }
    this.geometry.material = new ColorMaterialProperty(this.originalColor!);
  }
}

const extractTilesetAttributes = (
  tileset: PickableCesium3DTileset,
): LayerInfoAttribute[] => {
  const attributes: LayerInfoAttribute[] = [];
  const propertyNames = sortPropertyNames(
    Object.keys(tileset.customProperties),
    tileset.customProperties.propsOrder as string[],
  );

  for (const propertyName of propertyNames) {
    const value = tileset.customProperties[propertyName] as any;
    if (
      (typeof value === 'number' || !!value) &&
      !PROPERTIES_TO_EXCLUDE.includes(propertyName)
    ) {
      attributes.push({ key: `assets:${propertyName}`, value });
    }
  }
  return attributes;
};

const extractFeatureAttributes = (
  feature: Cesium3DTileFeature,
): LayerInfoAttribute[] => {
  const attributes: LayerInfoAttribute[] = [];
  const propertyNames = sortPropertyNames(
    feature.getPropertyIds(),
    ((feature.tileset as PickableCesium3DTileset).customProperties
      ?.propsOrder as string[]) ?? [],
  );
  for (const propertyName of propertyNames) {
    const value = feature.getProperty(propertyName);
    if (typeof value === 'number' || !!value) {
      attributes.push({ key: `assets:${propertyName}`, value });
    }
  }
  return attributes;
};

const extractEntityAttributes = (
  viewer: Viewer,
  entity: Entity,
): LayerInfoAttribute[] => {
  if (entity.properties === undefined) {
    return [];
  }

  const geomDataSource = viewer.dataSources.getByName(
    GEOMETRY_DATASOURCE_NAME,
  )[0];
  const noEditGeomDataSource = viewer.dataSources.getByName(
    NO_EDIT_GEOMETRY_DATASOURCE_NAME,
  )[0];

  if (
    geomDataSource.entities.contains(entity) ||
    noEditGeomDataSource.entities.contains(entity)
  ) {
    // If the entity is a drawing, then we simply show its id.
    return [{ key: 'geomId', value: entity.id }];
  }

  const properties = entity.properties.getValue(
    JulianDate.fromDate(new Date()),
  );
  const sortedPropertyNames = sortPropertyNames(
    Object.keys(properties),
    properties.propsOrder,
  );

  const attributes: LayerInfoAttribute[] = [{ key: 'id', value: entity.id }];
  for (const key of sortedPropertyNames) {
    const value = properties[key];
    if (
      typeof value === 'number' ||
      isTemplateResult(value) ||
      (typeof value === 'string' && /[A-Za-z0-9]/g.test(value))
    ) {
      attributes.push({ key, value });
    }
  }
  return attributes;
};

const sortPropertyNames = (
  propertyNames: string[],
  propertiesOrder: string[] = [],
): string[] => {
  const lowerPriorityProps = propertyNames
    .filter((prop) => !propertiesOrder.includes(prop))
    .sort((left, right) => {
      const titleLeft = left.toLowerCase();
      const titleRight = right.toLowerCase();
      if (titleLeft === titleRight) {
        return 0;
      }
      return titleLeft > titleRight ? 1 : -1;
    });
  return [...propertiesOrder, ...lowerPriorityProps];
};

/**
 * Whether the passed value follows the lit TemplateResult interface.
 * @param {unknown} value
 * @return {boolean}
 */
const isTemplateResult = (value: unknown): value is TemplateResult => {
  return (
    value !== null &&
    typeof value === 'object' &&
    'strings' in value &&
    'values' in value
  );
};
