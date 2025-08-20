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
  HeadingPitchRange,
  Viewer,
} from 'cesium';
import {
  DRILL_PICK_LENGTH,
  DRILL_PICK_LIMIT,
  OBJECT_HIGHLIGHT_COLOR,
  OBJECT_ZOOMTO_RADIUS,
} from 'src/constants';
import NavToolsStore from 'src/store/navTools';

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
    if (feature !== null && !(feature instanceof Cesium3DTileFeature)) {
      console.log(feature);
      throw new Error('ups');
    }
    if (feature === null || !feature.tileset['pickable']) {
      return [];
    }
    const attributes = extractFeatureAttributes(feature);
    return [
      new LayerInfoFor3dTiles(this.viewer, {
        feature,
        position: pick.cartesian,
        attributes,
        source: this.source,
        title: this.layer.label,
      }),
    ];
  }

  destroy(): void {}

  private pickByDrill(pick: LayerPickData): unknown | null {
    const windowPosition = this.viewer.scene.cartesianToCanvasCoordinates(
      pick.cartesian,
    );

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

class LayerInfoFor3dTiles implements LayerInfo {
  public readonly source: LayerTreeNode;
  public readonly title: string;
  public readonly attributes: LayerInfoAttribute[];

  private readonly feature: Cesium3DTileFeature;
  private readonly position: Cartesian3;

  private readonly originalColor: Color;

  constructor(
    private readonly viewer: Viewer,
    data: Pick<LayerInfo, 'source' | 'title' | 'attributes'> & {
      feature: Cesium3DTileFeature;
      source: LayerTreeNode;
      position: Cartesian3;
    },
  ) {
    this.feature = data.feature;
    this.position = data.position;
    this.source = data.source;
    this.title = data.title;
    this.attributes = data.attributes;

    this.originalColor = Color.clone(this.feature.color);
    this.feature.color = OBJECT_HIGHLIGHT_COLOR.withAlpha(
      this.feature.color.alpha,
    );
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
    this.feature.color = this.originalColor;
  }
}

const extractFeatureAttributes = (
  feature: Cesium3DTileFeature,
): LayerInfoAttribute[] => {
  const attributes: LayerInfoAttribute[] = [];
  const propertyNames = sortPropertyNames(
    feature.getPropertyIds(),
    feature.tileset.properties?.propsOrder ?? [],
  );
  for (const propertyName of propertyNames) {
    const value = feature.getProperty(propertyName);
    if (typeof value === 'number' || !!value) {
      attributes.push({ key: `assets:${propertyName}`, value });
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
