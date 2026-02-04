import {
  BaseLayerController,
  LayerService,
  LayerType,
  mapLayerSourceToResource,
  Tiles3dLayer,
  Tiles3dLayerController,
} from 'src/features/layer';
import { GeoJsonLayer } from 'src/features/layer/models/layer-geojson.model';
import {
  GeoJsonDataSource,
  JulianDate,
  ColorMaterialProperty,
  ConstantProperty,
  Color,
  Entity,
  ClassificationType,
  Cesium3DTileset,
  CustomDataSource,
} from 'cesium';
import { DEFAULT_UPLOADED_GEOJSON_COLOR } from 'src/constants';
import { makeId } from 'src/models/id.model';

export class GeoJsonLayerController extends BaseLayerController<GeoJsonLayer> {
  private dataSource!: CustomDataSource;
  private terrainController!: Tiles3dLayerController | null;

  get type(): LayerType.GeoJson {
    return LayerType.GeoJson;
  }

  /**
   * The tileset representing the geojsons's terrain,
   * or `null`, if the layer does not have a custom terrain.
   */
  get terrain(): Cesium3DTileset | null {
    return this.terrainController?.tileset ?? null;
  }

  zoomIntoView() {
    this.viewer.flyTo(this.dataSource).then();
  }

  moveToTop(): void {
    this.terrainController?.moveToTop();
    this.viewer.dataSources.raiseToTop(this.dataSource);
  }

  protected reactToChanges(): void {
    this.watch(this.layer.source);

    this.watch(this.layer.isVisible, (isVisible) => {
      this.dataSource.show = isVisible;
    });

    this.watch(this.layer.opacity, (opacity) => {
      this.setLayerOpacity(opacity);
    });
  }

  protected async addToViewer(): Promise<void> {
    if (this.layer.terrain) {
      this.terrainController = this.makeTerrainController();
      await this.terrainController.add();
    }

    const resource = await mapLayerSourceToResource(this.layer.source);
    const geoJsonDataSource = await GeoJsonDataSource.load(resource);

    if (this.dataSource === undefined) {
      this.dataSource = new CustomDataSource();
      await this.viewer.dataSources.add(this.dataSource);
    } else {
      this.dataSource.entities.removeAll();
    }

    const { dataSource } = this;
    dataSource.name = geoJsonDataSource.name;

    geoJsonDataSource.entities.suspendEvents();
    this.dataSource.entities.suspendEvents();

    const classificationType = this.terrainController
      ? ClassificationType.CESIUM_3D_TILE
      : ClassificationType.BOTH;
    for (const ent of geoJsonDataSource.entities.values) {
      if (dataSource.name.length === 0) {
        dataSource.name = ent.name ?? '';
      }
      if (ent.polyline) {
        const positions = ent.polyline.positions?.getValue(JulianDate.now());
        if (!positions?.length) {
          continue;
        }

        const polyline = new Entity({
          name: `${ent.id}-polyline`,
          polyline: {
            positions,
            classificationType,
            clampToGround: true,
            width: ent.polyline.width?.getValue(JulianDate.now()) ?? 2,
            material: ent.polyline.material,
          },
          properties: ent.properties,
        });
        dataSource.entities.add(polyline);
      }
      if (ent.polygon) {
        const hierarchy = ent.polygon.hierarchy?.getValue(JulianDate.now());
        if (!hierarchy?.positions?.length) {
          continue;
        }

        const polygon = new Entity({
          name: `${ent.id}-polygon`,
          polygon: {
            hierarchy,
            classificationType,
            outline: false,
            material: ent.polygon.material,
          },
          properties: ent.properties,
        });
        // When clamping a GeoJson to the ground, the borders disappear.
        // This is why we add the borders manually for all Polygon Entities
        const border = new Entity({
          name: `${ent.id}-border`,
          polyline: {
            classificationType,
            positions: hierarchy.positions,
            clampToGround: true,
            width: ent.polygon.outlineWidth?.getValue(JulianDate.now()) ?? 2,
            material:
              ent.polygon.outlineColor?.getValue(JulianDate.now()) ??
              DEFAULT_UPLOADED_GEOJSON_COLOR,
          },
          properties: ent.properties,
        });
        dataSource.entities.add(polygon);
        dataSource.entities.add(border);
      }
    }
    dataSource.entities.resumeEvents();
    geoJsonDataSource.entities.resumeEvents();

    if (this.layer.label == null) {
      LayerService.get().update(this.layer.id, { label: this.dataSource.name });
    }
  }

  protected removeFromViewer(): void {
    this.terrainController?.remove();
    this.viewer.dataSources.remove(this.dataSource, true);
  }

  private makeTerrainController(): Tiles3dLayerController {
    return new Tiles3dLayerController(this.makeTiles3dLayer());
  }

  private makeTiles3dLayer(): Tiles3dLayer {
    return {
      type: LayerType.Tiles3d,
      id: makeId(this.layer.id),
      source: this.layer.terrain!,
      isVisible: this.layer.isVisible,
      // We cannot use the same approach as we do with the TIFF layers, where we set isPartiallyTransparent to true and add the Source to the imagery layers,
      // because GeoJson layers cannot be added to the tileset's imagery layers.
      // That would discard all fragments of the tilesets, including parts that are covered by the GeoJson.
      // Instead, we set the opacity to 0, making the tileset fully invisible, but still allowing the GeoJson to be clamped to it.
      opacity: 0,
      canUpdateOpacity: false,
      downloadUrl: null,
      geocatId: null,
      label: null,
      legend: null,
      orderOfProperties: [],
      customProperties: {},
      isPartiallyTransparent: false,
    };
  }

  private setLayerOpacity(opacity: number): void {
    const { dataSource } = this;
    const now = JulianDate.now();
    for (const ent of dataSource.entities.values) {
      if (ent.billboard) {
        const props = ent.properties?.getValue(now);
        const hex = props?.['marker-color'];
        if (typeof hex === 'string') {
          const color = Color.fromAlpha(Color.fromCssColorString(hex), opacity);
          ent.billboard.color = new ConstantProperty(color);
        }
      }
      if (ent.polygon) {
        const polygon = ent.polygon;
        const base = polygon.material.getValue(now).color;
        polygon.material = new ColorMaterialProperty(
          Color.fromAlpha(base, opacity),
        );
      }
      if (ent.polyline) {
        const line = ent.polyline;
        const base = line.material.getValue(now).color;
        line.material = new ColorMaterialProperty(
          Color.fromAlpha(base, opacity),
        );
      }
    }
  }
}
