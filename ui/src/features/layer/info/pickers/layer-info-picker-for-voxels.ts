import {
  LayerInfoPicker,
  LayerPickData,
} from 'src/features/layer/info/pickers/layer-info-picker';
import { LayerInfo, LayerInfoAttribute } from '../layer-info.model';
import { LayerConfig, LayerTreeNode, voxelLayerToFilter } from 'src/layertree';
import {
  BoundingSphere,
  Math as CesiumMath,
  HeadingPitchRange,
  Viewer,
  VoxelCell,
} from 'cesium';
import { PickableVoxelPrimitive } from 'src/layers/helpers';
import i18next from 'i18next';
import { formatCartesian3AsLv95 } from 'src/projection';
import NavToolsStore from 'src/store/navTools';

export class LayerInfoPickerForVoxels implements LayerInfoPicker {
  constructor(
    private readonly layer: LayerTreeNode,
    private readonly viewer: Viewer,
  ) {}

  get source(): LayerTreeNode {
    return this.layer;
  }

  async pick(pick: LayerPickData): Promise<LayerInfo[]> {
    const windowPosition = this.viewer.scene.cartesianToCanvasCoordinates(
      pick.cartesian,
    );
    if (windowPosition === undefined) {
      return [];
    }

    if (windowPosition === undefined) {
      return [];
    }

    const primitive = await (this.layer as LayerConfig).promise;

    const cell = this.viewer.scene.pickVoxel(windowPosition);
    if (
      cell === undefined ||
      !isPickable(cell) ||
      cell.primitive !== primitive
    ) {
      return [];
    }

    const attributes = extractVoxelAttributes(cell);

    const { customShader } = cell.primitive;
    customShader.setUniform('u_selectedTile', cell.tileIndex);
    customShader.setUniform('u_selectedSample', cell.sampleIndex);

    return [
      new LayerInfoForVoxels(this.viewer, {
        cell,
        attributes,
        source: this.source,
        title: this.layer.label,
      }),
    ];
  }

  destroy(): void {}
}

class LayerInfoForVoxels implements LayerInfo {
  public readonly source: LayerTreeNode;
  public readonly title: string;
  public readonly attributes: LayerInfoAttribute[];

  private readonly cell: VoxelCell;

  constructor(
    private readonly viewer: Viewer,
    data: Pick<LayerInfo, 'source' | 'title' | 'attributes'> & {
      cell: VoxelCell;
      source: LayerTreeNode;
    },
  ) {
    this.cell = data.cell;
    this.source = data.source;
    this.title = data.title;
    this.attributes = data.attributes;
  }

  zoomToObject(): void {
    NavToolsStore.hideTargetPoint();
    const boundingSphere = BoundingSphere.fromOrientedBoundingBox(
      this.cell.orientedBoundingBox,
    );
    const zoomHeadingPitchRange = new HeadingPitchRange(
      0,
      CesiumMath.toRadians(-90.0),
      boundingSphere.radius * 3,
    );
    this.viewer.scene.camera.flyToBoundingSphere(boundingSphere, {
      duration: 0,
      offset: zoomHeadingPitchRange,
    });
  }

  activateHighlight(): void {}

  deactivateHighlight(): void {}

  destroy(): void {
    const { customShader } = this.cell.primitive;
    if (
      customShader.uniforms['u_selectedTile'].value !== this.cell.tileIndex ||
      customShader.uniforms['u_selectedSample'].value !== this.cell.sampleIndex
    ) {
      return;
    }
    customShader.setUniform('u_selectedTile', -1);
    customShader.setUniform('u_selectedSample', -1);
  }
}

const isPickable = (object: VoxelCell) => {
  const voxelPrimitive: PickableVoxelPrimitive = object.primitive;
  return voxelPrimitive && voxelPrimitive.pickable;
};

export function extractVoxelAttributes(cell: VoxelCell): LayerInfoAttribute[] {
  const cellCenter = cell.orientedBoundingBox.center;
  const propertyNames: string[] = cell.getNames();
  const primitive: PickableVoxelPrimitive = cell.primitive;
  const layer = primitive.layer;
  const attributes: LayerInfoAttribute[] = propertyNames.map((name) => {
    const value = cell.getProperty(name);
    if (name === 'Temp_C') {
      return { key: i18next.t('vox_temperature'), value };
    }
    if (layer && voxelLayerToFilter[layer]) {
      const filters = voxelLayerToFilter[layer];
      if (name === filters.lithologyDataName) {
        const label = filters.lithology.find(
          (f) => f.value === value[0],
        )?.label;
        const title =
          name === 'Klasse'
            ? i18next.t('vox_filter_klasse')
            : i18next.t('vox_filter_lithology');
        return {
          key: title,
          value: label
            ? i18next.t(label)
            : i18next.t('vox_filter_undefined_lithology'),
        };
      }
      if (name === filters.conductivityDataName) {
        const valueOrUndefined =
          value[0] <= -9999
            ? i18next.t('vox_filter_undefined_lithology')
            : value;

        return {
          key: i18next.t('vox_filter_hydraulic_conductivity'),
          value: valueOrUndefined,
        };
      }
    }
    return { key: name, value };
  });
  return [
    ...attributes,
    {
      key: i18next.t('vox_cell_center'),
      value: formatCartesian3AsLv95(cellCenter).join(', '),
    },
  ];
}
