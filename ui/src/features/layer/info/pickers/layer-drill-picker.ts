import {
  LayerInfoPicker,
  LayerPickData,
} from 'src/features/layer/info/pickers/layer-info-picker';
import { LayerInfo, LayerInfoAttribute } from '../layer-info.model';
import {
  BoundingSphere,
  CallbackProperty,
  Cartesian3,
  Cesium3DTileFeature,
  Cesium3DTileset,
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
import {
  getUnitKey,
  setUnitHighlight,
} from 'src/features/layer/utils/tiles3d-color-style';
import { HighlightColorMaterialProperty } from 'src/features/layer/utils/highlight-color-material-property';
import NavToolsStore from 'src/store/navTools';
import { TemplateResult } from 'lit';
import {
  BaseLayerController,
  getTranslationKeyForLayerAttributeName,
  Layer,
} from 'src/features/layer';
import { Id } from 'src/models/id.model';

const PROPERTIES_TO_EXCLUDE = new Set([
  'color_blue',
  'color_green',
  'color_red',
  'model_feature',
  'm_alias',
  'oname',
  'style_transparency',
]);

// Internal attributes of vector tiles colored by `Hex_color`.
const VECTOR_PROPERTIES_TO_EXCLUDE = new Set([
  '_id',
  'R',
  'G',
  'B',
  'Hex_color',
  'Category',
  'Q__count',
]);

/**
 * `Cesium3DTileVectorFeature` is returned for vector 3D Tiles (`VectorGltf3DTileContent`).
 * It is not exported in Cesium's typings and does not extend `Cesium3DTileFeature`,
 * but offers the same property and color API. It is detected via its unique
 * `addPrimitiveByCollection` method, as class names do not survive minification.
 */
type VectorTileFeature = Pick<
  Cesium3DTileFeature,
  'color' | 'getPropertyIds' | 'getProperty' | 'tileset'
>;

const isVectorTileFeature = (feature: unknown): feature is VectorTileFeature =>
  typeof feature === 'object' &&
  feature !== null &&
  typeof (feature as VectorTileFeature & Record<string, unknown>)
    .addPrimitiveByCollection === 'function';

export abstract class LayerInfoDrillPicker<
  T extends Layer,
> implements LayerInfoPicker {
  constructor(
    private readonly controller: BaseLayerController<T>,
    private readonly viewer: Viewer,
  ) {}

  get layerId(): Id<T> {
    return this.layer.id as Id<T>;
  }

  protected get layer(): T {
    return this.controller.layer;
  }

  async pick(pick: LayerPickData): Promise<LayerInfo[]> {
    if (!this.layer.isVisible || this.layer.opacity === 0) {
      return [];
    }
    const feature = this.pickByDrill(pick);
    if (feature === null) {
      return [];
    }
    if (
      feature instanceof Cesium3DTileFeature ||
      isVectorTileFeature(feature)
    ) {
      return this.controller.ownsSceneObject(feature.tileset)
        ? this.pickFeature(pick, feature)
        : [];
    }

    const tileset = (feature as any).content?._tileset as
      Cesium3DTileset | undefined;
    if (tileset !== undefined) {
      return this.controller.ownsSceneObject(tileset) && 'metadata' in tileset
        ? this.pickFeatureForNewTileset(pick, tileset)
        : [];
    }
    if (
      typeof feature === 'object' &&
      'primitive' in feature &&
      'id' in feature &&
      feature.id instanceof Entity
    ) {
      return this.controller.ownsSceneObject(feature.id)
        ? this.pickEntity(feature.id, feature.primitive as object)
        : [];
    }
    return [];
  }

  destroy(): void {
    // Nothing to do here.
  }

  abstract get orderOfProperties(): string[];

  private pickFeature(
    pick: LayerPickData,
    feature: Cesium3DTileFeature | VectorTileFeature,
  ): LayerInfo[] {
    const attributes = extractFeatureAttributes(
      feature,
      this.layer,
      this.orderOfProperties,
    );
    return [
      new LayerInfoForFeature(this.viewer, {
        feature,
        featureLabel: findFeatureLabel((name) => feature.getProperty(name)),
        position: pick.globePosition.cartesian,
        attributes,
        layerId: this.controller.layer.id,
        title: `layers:layers.${this.controller.layer.id}`,
      }),
    ];
  }

  private pickFeatureForNewTileset(
    pick: LayerPickData,
    tileset: Cesium3DTileset,
  ) {
    const attributes: LayerInfoAttribute[] = extractTilesetAttributes(
      tileset,
      this.layer,
      this.orderOfProperties,
    );
    return [
      new LayerInfoForFeature(this.viewer, {
        feature: tileset,
        position: pick.globePosition.cartesian,
        attributes,
        layerId: this.controller.layer.id,
        title:
          this.controller.layer.label ??
          `layers:layers.${this.controller.layer.id}`,
      }),
    ];
  }

  private pickEntity(entity: Entity, primitive: object): LayerInfo[] {
    if (primitive?.['allowPicking'] === false) {
      return [];
    }

    const attributes = extractEntityAttributes(
      this.viewer,
      entity,
      this.orderOfProperties,
    );
    if (attributes.length === 0) {
      return [];
    }
    return [
      new LayerInfoForEntity(this.viewer, {
        entity,
        featureLabel:
          entity.name ||
          findFeatureLabel((name) =>
            entity.properties?.[name]?.getValue(JulianDate.now()),
          ),
        attributes,
        layerId: this.layerId,
        title:
          this.controller.layer.label ??
          `layers:layers.${this.controller.layer.id}`,
      }),
    ];
  }

  private pickByDrill(pick: LayerPickData): unknown | null {
    const objects = this.viewer.scene.drillPick(
      pick.windowPosition,
      DRILL_PICK_LIMIT,
      DRILL_PICK_LENGTH,
      DRILL_PICK_LENGTH,
    );
    if (objects.length === 0) {
      return null;
    }

    const slicerDataSource = this.viewer.dataSources.getByName('slicer')[0];
    // Keep the frontmost scene object. Filtering for each layer's first owned
    // hit would select objects behind it. Only slicing helpers are skipped.
    return (
      objects.find(
        (object) =>
          object.id == null || !slicerDataSource?.entities.contains(object.id),
      ) ?? null
    );
  }
}

const findFeatureLabel = (
  getValue: (name: string) => unknown,
): string | undefined => {
  for (const name of [
    'name',
    'Name',
    'label',
    'Label',
    'EventLocationName',
    'GeolCode',
  ]) {
    const value = getValue(name);
    if (
      typeof value === 'string' &&
      value.trim() !== '' &&
      value.trim() !== '-'
    ) {
      return value.trim();
    }
  }
  return undefined;
};

class LayerInfoForFeature implements LayerInfo {
  public readonly layerId: Id<Layer>;
  public readonly title: string;
  public readonly attributes: LayerInfoAttribute[];
  public readonly featureLabel?: string;
  public readonly match = 'scene';

  private readonly feature:
    Cesium3DTileFeature | VectorTileFeature | Cesium3DTileset;
  private readonly position: Cartesian3;
  private readonly tileset: Cesium3DTileset;
  private clearHighlight: (() => void) | null = null;

  constructor(
    private readonly viewer: Viewer,
    data: Pick<
      LayerInfo,
      'layerId' | 'title' | 'attributes' | 'featureLabel'
    > & {
      feature: Cesium3DTileFeature | VectorTileFeature | Cesium3DTileset;
      position: Cartesian3;
    },
  ) {
    this.feature = data.feature;
    this.tileset =
      data.feature instanceof Cesium3DTileFeature ||
      isVectorTileFeature(data.feature)
        ? data.feature.tileset
        : data.feature;
    this.position = data.position;
    this.layerId = data.layerId;
    this.title = data.title;
    this.attributes = data.attributes;
    this.featureLabel = data.featureLabel;
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

  select(): void {
    const { feature, tileset } = this;
    if (this.clearHighlight !== null || tileset.isDestroyed()) {
      return;
    }
    if (
      feature instanceof Cesium3DTileFeature ||
      isVectorTileFeature(feature)
    ) {
      // Cesium exposes content at runtime. Its tile may unload while the panel is open.
      const { content } = feature as typeof feature & {
        content?: { isDestroyed?: () => boolean };
      };
      if (content?.isDestroyed?.()) {
        return;
      }
      const unit = isVectorTileFeature(feature)
        ? getUnitKey(tileset, feature)
        : null;
      if (unit !== null) {
        // Fragments of the picked geological unit share its highlight.
        setUnitHighlight(
          tileset,
          unit,
          OBJECT_HIGHLIGHT_COLOR.toCssHexString(),
        );
        this.clearHighlight = () => setUnitHighlight(tileset, null);
      } else {
        const originalColor = Color.clone(feature.color);
        feature.color = OBJECT_HIGHLIGHT_COLOR.withAlpha(originalColor.alpha);
        this.clearHighlight = () => {
          if (!content?.isDestroyed?.()) {
            feature.color = originalColor;
          }
        };
      }
    } else {
      const { customShader } = feature;
      customShader?.setUniform('u_isHighlighted', true);
      this.clearHighlight = () =>
        customShader?.setUniform('u_isHighlighted', false);
    }
  }

  deselect(): void {
    const clear = this.clearHighlight;
    this.clearHighlight = null;
    // Layer removal destroys Cesium content before publishing deactivation.
    if (clear !== null && !this.tileset.isDestroyed()) {
      clear();
    }
  }

  destroy(): void {
    this.deselect();
  }
}

class LayerInfoForEntity implements LayerInfo {
  public readonly layerId: Id<Layer>;
  public readonly title: string;
  public readonly attributes: LayerInfoAttribute[];
  public readonly featureLabel?: string;
  public readonly match = 'scene';

  private readonly entity: Entity;
  private clearHighlight: (() => void) | null = null;

  constructor(
    private readonly viewer: Viewer,
    data: Pick<
      LayerInfo,
      'layerId' | 'title' | 'attributes' | 'featureLabel'
    > & {
      entity: Entity;
    },
  ) {
    this.entity = data.entity;
    this.layerId = data.layerId;
    this.title = data.title;
    this.attributes = data.attributes;
    this.featureLabel = data.featureLabel;
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
    this.viewer.zoomTo(this.entity, props?.zoomHeadingPitchRange).then();
  }

  select(): void {
    if (this.clearHighlight !== null) {
      return;
    }
    const geometry = this.findGeometry();
    if (geometry !== null) {
      const highlightedMaterial = new HighlightColorMaterialProperty(
        geometry.material,
      );
      geometry.material = highlightedMaterial;
      this.clearHighlight = () => {
        if (geometry.material === highlightedMaterial) {
          geometry.material = highlightedMaterial.baseMaterial;
        }
      };
      return;
    }
    const { billboard } = this.entity;
    if (billboard !== undefined) {
      const previousColor = billboard.color;
      const highlightedColor = new CallbackProperty(
        (time, result) =>
          OBJECT_HIGHLIGHT_COLOR.withAlpha(
            previousColor?.getValue(time)?.alpha ?? 1,
            result,
          ),
        previousColor?.isConstant ?? true,
      );
      billboard.color = highlightedColor;
      this.clearHighlight = () => {
        if (billboard.color === highlightedColor) {
          billboard.color = previousColor;
        }
      };
    }
  }

  deselect(): void {
    const clear = this.clearHighlight;
    this.clearHighlight = null;
    clear?.();
  }

  destroy(): void {
    this.deselect();
  }
}

const extractFeatureAttributes = (
  feature: Cesium3DTileFeature | VectorTileFeature,
  layer: Layer,
  orderOfProperties: string[],
): LayerInfoAttribute[] => {
  const attributes: LayerInfoAttribute[] = [];
  const propertyNames = sortPropertyNames(
    feature.getPropertyIds(),
    orderOfProperties,
  );
  const isVector = isVectorTileFeature(feature);
  for (const propertyName of propertyNames) {
    if (isVector && VECTOR_PROPERTIES_TO_EXCLUDE.has(propertyName)) {
      continue;
    }
    const value = feature.getProperty(propertyName);
    if (typeof value === 'number' || !!value) {
      attributes.push({
        key: getTranslationKeyForLayerAttributeName(layer, propertyName),
        value,
      });
    }
  }
  return attributes;
};

const extractEntityAttributes = (
  viewer: Viewer,
  entity: Entity,
  orderOfProperties: string[],
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
    geomDataSource?.entities.contains(entity) ||
    noEditGeomDataSource?.entities.contains(entity)
  ) {
    // If the entity is a drawing, then we simply show its id.
    return [{ key: 'geomId', value: entity.id }];
  }

  const properties = entity.properties.getValue(
    JulianDate.fromDate(new Date()),
  );
  const sortedPropertyNames = sortPropertyNames(
    Object.keys(properties),
    orderOfProperties,
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

const extractTilesetAttributes = (
  tileset: Cesium3DTileset,
  layer: Layer,
  orderOfProperties: string[],
): LayerInfoAttribute[] => {
  const metadata = tileset['metadata'];
  if (metadata == null) {
    return [];
  }

  const properties: Record<string, unknown> = metadata
    .getPropertyIds()
    .reduce((acc: Record<string, unknown>, id: string) => {
      return {
        ...acc,
        [id]: metadata.getProperty(id)[0],
      };
    }, {});

  const attributes: LayerInfoAttribute[] = [];
  const propertyNames = sortPropertyNames(
    Object.keys(properties),
    orderOfProperties,
  );

  for (const propertyName of propertyNames) {
    const value = properties[propertyName] as any;
    if (
      (typeof value === 'number' || !!value) &&
      !PROPERTIES_TO_EXCLUDE.has(propertyName)
    ) {
      attributes.push({
        key: getTranslationKeyForLayerAttributeName(layer, propertyName),
        value,
      });
    }
  }
  return attributes;
};

const sortPropertyNames = (
  propertyNames: string[],
  orderOfProperties: string[] = [],
): string[] => {
  const lowerPriorityProps = propertyNames
    .filter((prop) => !orderOfProperties.includes(prop))
    .sort((left, right) => {
      const titleLeft = left.toLowerCase();
      const titleRight = right.toLowerCase();
      if (titleLeft === titleRight) {
        return 0;
      }
      return titleLeft > titleRight ? 1 : -1;
    });
  return [...orderOfProperties, ...lowerPriorityProps];
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
