import {
  BaseLayerController,
  LayerService,
  LayerType,
  mapLayerSourceToResource,
} from 'src/features/layer';
import { GeoJsonLayer } from 'src/features/layer/models/layer-geojson.model';
import {
  GeoJsonDataSource,
  JulianDate,
  ColorMaterialProperty,
  ConstantProperty,
  Color,
  Entity,
} from 'cesium';
import { DEFAULT_UPLOADED_KML_COLOR } from 'src/constants';

export class GeoJsonLayerController extends BaseLayerController<GeoJsonLayer> {
  private dataSource!: GeoJsonDataSource;

  get type(): LayerType.GeoJson {
    return LayerType.GeoJson;
  }

  zoomIntoView() {
    this.viewer.flyTo(this.dataSource).then();
  }

  moveToTop(): void {
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
    const resource = await mapLayerSourceToResource(this.layer.source);
    const geoJsonDataSource = await GeoJsonDataSource.load(resource, {
      clampToGround: this.layer.shouldClampToGround,
    });

    if (this.dataSource === undefined) {
      this.dataSource = geoJsonDataSource;
      await this.viewer.dataSources.add(this.dataSource);
    } else {
      this.dataSource.entities.removeAll();
    }

    geoJsonDataSource.entities.suspendEvents();

    for (const ent of this.dataSource.entities.values) {
      if (ent.polygon) {
        const polygon = ent.polygon;
        polygon.outline = new ConstantProperty(false);
        const hierarchy = polygon.hierarchy?.getValue(JulianDate.now());
        if (!hierarchy?.positions?.length) {
          continue;
        }

        // When clamping a GeoJson to the ground, the borders disappear.
        // This is why we add the borders manually for all Polygon Entities
        const border = new Entity({
          name: `${ent.id}-border`,
          polyline: {
            positions: hierarchy.positions,
            clampToGround: true,
            width: polygon.outlineWidth?.getValue(JulianDate.now()) ?? 2,
            material:
              polygon.outlineColor?.getValue(JulianDate.now()) ??
              DEFAULT_UPLOADED_KML_COLOR,
          },
        });
        geoJsonDataSource.entities.add(border);
      }
    }
    geoJsonDataSource.entities.resumeEvents();

    if (this.layer.label == null) {
      LayerService.get().update(this.layer.id, { label: this.dataSource.name });
    }
  }

  protected removeFromViewer(): void {
    this.viewer.dataSources.remove(this.dataSource, true);
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
