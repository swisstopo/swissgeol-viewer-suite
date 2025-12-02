import {
  LayerInfoPicker,
  LayerPickData,
} from 'src/features/layer/info/pickers/layer-info-picker';
import { LayerInfo, LayerInfoAttribute } from '../layer-info.model';
import {
  BoundingSphere,
  HeadingPitchRange,
  Math as CesiumMath,
  Viewer,
  VoxelCell,
} from 'cesium';
import { formatCartesian3AsLv95 } from 'src/projection';
import NavToolsStore from 'src/store/navTools';
import { VoxelLayerController } from 'src/features/layer/controllers/layer-voxel.controller';
import { Id } from 'src/models/id.model';
import {
  getTranslationKeyForLayerPropertyName,
  VoxelLayer,
  VoxelLayerMappingType,
} from 'src/features/layer';
import { makeTranslationKey } from 'src/models/translation-key.model';

export class LayerInfoPickerForVoxels implements LayerInfoPicker {
  constructor(
    private readonly controller: VoxelLayerController,
    private readonly viewer: Viewer,
  ) {}

  get layerId(): Id<VoxelLayer> {
    return this.controller.layer.id;
  }

  async pick(pick: LayerPickData): Promise<LayerInfo[]> {
    const cell = this.viewer.scene.pickVoxel(pick.windowPosition);
    if (cell === undefined || cell.primitive !== this.controller.primitive) {
      return [];
    }

    const attributes = this.extractVoxelAttributes(cell);

    const { customShader } = cell.primitive;
    customShader.setUniform('u_selectedTile', cell.tileIndex);
    customShader.setUniform('u_selectedSample', cell.sampleIndex);

    return [
      new LayerInfoForVoxels(this.viewer, {
        cell,
        attributes,
        layerId: this.controller.layer.id,
        title: `layers:layers.${this.controller.layer.id}`,
      }),
    ];
  }

  destroy(): void {}

  private extractVoxelAttributes(cell: VoxelCell): LayerInfoAttribute[] {
    const cellCenter = cell.orientedBoundingBox.center;
    const propertyNames: string[] = cell.getNames();
    const { layer } = this.controller;
    const attributes: LayerInfoAttribute[] = propertyNames.map(
      (propertyName) => {
        const keyLabels = getTranslationKeyForLayerPropertyName(
          layer,
          propertyName,
        );
        const value = cell.getProperty(propertyName)[0] as number;

        const mapping = this.controller.layer.mappings.find(
          (mapping) => mapping.key === propertyName,
        );
        if (
          mapping !== undefined &&
          mapping.type === VoxelLayerMappingType.Item
        ) {
          const valueLabel = mapping.items.find(
            (it) => it.value === value,
          )?.label;
          if (valueLabel !== undefined) {
            return { key: keyLabels, value: valueLabel };
          }
        }

        const valueLabel =
          value === this.controller.layer.values.undefined
            ? getTranslationKeyForLayerPropertyName(
                this.controller.layer,
                'undefined',
              )
            : value;
        return { key: keyLabels, value: valueLabel };
      },
    );
    return [
      ...attributes,
      {
        key: getTranslationKeyForLayerPropertyName(
          this.controller.layer,
          'cell_center',
        ),
        value: formatCartesian3AsLv95(cellCenter).join(', '),
      },
    ];
  }
}

class LayerInfoForVoxels implements LayerInfo {
  public readonly layerId: Id<VoxelLayer>;
  public readonly title: string;
  public readonly attributes: LayerInfoAttribute[];

  private readonly cell: VoxelCell;

  constructor(
    private readonly viewer: Viewer,
    data: Pick<LayerInfo, 'layerId' | 'title' | 'attributes'> & {
      cell: VoxelCell;
      layerId: Id<VoxelLayer>;
    },
  ) {
    this.cell = data.cell;
    this.layerId = data.layerId;
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
