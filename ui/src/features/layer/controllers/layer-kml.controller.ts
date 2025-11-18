import {
  BaseLayerController,
  KmlLayer,
  LayerService,
  LayerType,
  mapLayerSourceToResource,
} from 'src/features/layer';
import {
  ArcType,
  Color,
  ColorMaterialProperty,
  ConstantPositionProperty,
  ConstantProperty,
  CustomDataSource,
  HeightReference,
  JulianDate,
  KmlDataSource,
} from 'cesium';
import { DEFAULT_UPLOADED_KML_COLOR } from 'src/constants';
import { updateExaggerationForCartesianPositions } from 'src/cesiumutils';

export class KmlLayerController extends BaseLayerController<KmlLayer> {
  private dataSource!: CustomDataSource;

  private currentExaggeration = 1;

  get type(): LayerType.Kml {
    return LayerType.Kml;
  }

  zoomIntoView(): void {
    this.viewer.flyTo(this.dataSource).then();
  }

  moveToTop(): void {
    this.viewer.dataSources.raiseToTop(this.dataSource);
  }

  updateExaggeration(exaggeration: number): void {
    this.dataSource.entities.suspendEvents();
    const exaggerationScale = exaggeration / this.currentExaggeration;
    this.dataSource.entities.values.forEach((ent) => {
      if (ent.position) {
        const position = ent.position.getValue(JulianDate.now());
        position &&
          updateExaggerationForCartesianPositions(
            [position],
            exaggerationScale,
          );
        ent.position = new ConstantPositionProperty(position);
      }
      if (ent['polygon']) {
        const polygon = ent['polygon'];
        const hierarchy = polygon?.hierarchy?.getValue(JulianDate.now());
        if (hierarchy?.positions) {
          const positions = updateExaggerationForCartesianPositions(
            hierarchy.positions,
            exaggerationScale,
          );
          polygon.hierarchy = new ConstantProperty({
            holes: [],
            positions,
          });
        }
      }
      if (ent['polyline']) {
        const line = ent['polyline'];
        const positions = line.positions?.getValue(JulianDate.now());
        if (positions) {
          line.positions = new ConstantProperty(
            updateExaggerationForCartesianPositions(
              positions,
              exaggerationScale,
            ),
          );
        }
      }
    });
    this.dataSource.entities.resumeEvents();
    this.currentExaggeration = exaggeration;
  }

  protected reactToChanges(): void {
    this.watch(this.layer.source);

    this.watch(this.layer.isVisible, (isVisible) => {
      this.dataSource.show = isVisible;
    });
  }

  protected async addToViewer(): Promise<void> {
    const resource =
      this.layer.source instanceof File
        ? this.layer.source
        : await mapLayerSourceToResource(this.layer.source);
    const kmlDataSource = await KmlDataSource.load(resource, {
      camera: this.viewer.scene.camera,
      canvas: this.viewer.scene.canvas,
      clampToGround: this.layer.shouldClampToGround,
    });
    if (this.dataSource === undefined) {
      this.dataSource = new CustomDataSource();
      await this.viewer.dataSources.add(this.dataSource);
    } else {
      this.dataSource.entities.removeAll();
    }
    const { dataSource } = this;
    dataSource.name = kmlDataSource.name;

    kmlDataSource.entities.suspendEvents();
    this.dataSource.entities.suspendEvents();

    for (const ent of kmlDataSource.entities.values) {
      ent.show = true;
      if (dataSource.name.length === 0) {
        dataSource.name = ent.name ?? '';
      }
      if (ent['point']) {
        const point = ent['point'];
        const color: Color =
          point.color?.getValue(JulianDate.now())?.color ||
          DEFAULT_UPLOADED_KML_COLOR;
        if (color.alpha === 0) {
          color.alpha = 1;
        }
        point.color = new ConstantProperty(color);
        point.pixelSize = point.pixelSize?.getValue(JulianDate.now()) || 1;
        point.heightReference = this.layer.shouldClampToGround
          ? HeightReference.CLAMP_TO_GROUND
          : point.heightReference?.getValue(JulianDate.now());
      }
      if (ent['polygon']) {
        const polygon = ent['polygon'];
        const color: Color =
          polygon.material?.getValue(JulianDate.now())?.color ||
          DEFAULT_UPLOADED_KML_COLOR;
        if (color.alpha === 0) {
          color.alpha = 1;
        }
        polygon.material = new ColorMaterialProperty(color);
        polygon.heightReference = this.layer.shouldClampToGround
          ? HeightReference.CLAMP_TO_GROUND
          : polygon.heightReference?.getValue(JulianDate.now());
      }
      if (ent['polyline']) {
        const line = ent['polyline'];
        const color: Color =
          line.material?.getValue(JulianDate.now())?.color ||
          DEFAULT_UPLOADED_KML_COLOR;
        if (color.alpha === 0) {
          color.alpha = 1;
        }
        line.arcType = new ConstantProperty(ArcType.GEODESIC);
        line.clampToGround = new ConstantProperty(
          this.layer.shouldClampToGround,
        );
        line.material = new ColorMaterialProperty(color);
        line.width = line.width?.getValue(JulianDate.now()) || 2;
      }
      dataSource.entities.add(ent);
    }
    dataSource.entities.resumeEvents();

    if (this.layer.label == null) {
      LayerService.get().update(this.layer.id, { label: dataSource.name });
    }

    const { verticalExaggeration: exaggeration } = this.viewer.scene;
    if (exaggeration !== 1) {
      this.updateExaggeration(exaggeration);
    }
  }

  protected removeFromViewer(): void {
    this.viewer.dataSources.remove(this.dataSource, true);
  }
}
