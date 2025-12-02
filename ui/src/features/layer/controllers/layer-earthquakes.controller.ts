import {
  BaseLayerController,
  EarthquakesLayer,
  LayerType,
  mapLayerSourceToResource,
} from 'src/features/layer';
import * as Cesium from 'cesium';
import {
  Cartesian3,
  Cartographic,
  Color,
  CustomDataSource,
  HeadingPitchRange,
  Math as CMath,
} from 'cesium';

// TODO We use a lot `any` in here, as the original earthquake implementation was plain JS.
//      Consider making this more strict if we ever get to work in here. (DVA, 2025-11-18)

export class EarthquakesLayerController extends BaseLayerController<EarthquakesLayer> {
  private dataSource!: CustomDataSource;

  get type(): LayerType.Earthquakes {
    return LayerType.Earthquakes;
  }

  zoomIntoView(): void {
    this.viewer.flyTo(this.dataSource).then();
  }

  moveToTop(): void {
    this.viewer.dataSources.raiseToTop(this.dataSource);
  }

  protected reactToChanges(): void {
    this.watch(this.layer.isVisible, (isVisible) => {
      this.dataSource.show = isVisible;
    });

    // Opacity is handled as a CallbackProperty.
  }

  protected async addToViewer(): Promise<void> {
    if (this.dataSource === undefined) {
      this.dataSource = new CustomDataSource();
      await this.viewer.dataSources.add(this.dataSource);
    } else {
      this.dataSource.entities.removeAll();
    }
    const resource = await mapLayerSourceToResource(this.layer.source);
    const text = (await resource.fetchText()) ?? '';
    const data = this.parseEarthquakeData(text);
    for (const entry of data) {
      this.registerEarthquakeEntity(entry);
    }
  }

  protected removeFromViewer(): void {
    this.viewer.dataSources.remove(this.dataSource, true);
  }

  private parseEarthquakeData(text: string): any[] {
    const earthquakeArr = text.trim().split('\n');
    const propsArr = earthquakeArr[0]
      .split('|')
      .map((propName) => propName.replace(/\W/g, ''));
    const values = earthquakeArr.slice(1);
    return values
      .map((val) => {
        const valuesArr = val.split('|');
        const earthquakeData = {};
        for (const i in propsArr) {
          switch (propsArr[i]) {
            case 'Time':
              earthquakeData[propsArr[i]] = valuesArr[i]
                .split('.')[0]
                .replace('T', ' ');
              break;
            case 'Magnitude':
              earthquakeData[propsArr[i]] =
                Number.parseFloat(valuesArr[i]).toFixed(1) + ' MLhc';
              break;
            case 'Depthkm':
              earthquakeData[propsArr[i]] =
                Number.parseFloat(valuesArr[i]).toFixed(1) + ' km';
              break;
            case 'EventLocationName':
            case 'Latitude':
            case 'Longitude':
              earthquakeData[propsArr[i]] = valuesArr[i];
              break;
            default:
              break;
          }
        }
        return earthquakeData as any;
      })
      .filter(
        (ed) =>
          !!ed.Latitude &&
          ed.Latitude.length &&
          !!ed.Longitude &&
          ed.Longitude.length &&
          !ed.Depthkm.startsWith('NaN'),
      );
  }

  private registerEarthquakeEntity(entry: any): void {
    const size =
      Number(entry.Magnitude.split(' ')[0]) *
      EARTHQUAKE_SPHERE_SIZE_COEFFICIENT;
    const depthMeters = Number(entry.Depthkm.split(' ')[0]) * 1000; // convert km to m
    const longitude = Number(entry.Longitude);
    const latitude = Number(entry.Latitude);
    delete entry.Longitude;
    delete entry.Latitude;
    const position = Cartesian3.fromDegrees(longitude, latitude, -depthMeters);
    const posCart = Cartographic.fromCartesian(position);
    const altitude = this.viewer.scene.globe.getHeight(posCart) || 0;
    posCart.height = posCart.height + altitude;
    Cartographic.toCartesian(posCart, undefined, position);
    const cameraDistance = size * 4;
    const zoomHeadingPitchRange = new HeadingPitchRange(
      0,
      CMath.toRadians(25),
      cameraDistance,
    );
    const color = getColorFromTime(entry.Time);
    this.dataSource.entities.add({
      position: position,
      ellipsoid: {
        radii: new Cartesian3(size, size, size),
        material: new Cesium.ColorMaterialProperty(
          new Cesium.CallbackProperty(() => {
            return color.withAlpha(this.layer.opacity);
          }, false),
        ),
      },
      properties: {
        ...entry,
        zoomHeadingPitchRange: zoomHeadingPitchRange,
      },
    });
  }
}

const EARTHQUAKE_SPHERE_SIZE_COEFFICIENT = 200;

/**
 * Returns color for an earthquake sphere representing its age.
 * Ranges from dark blue (age < 24h - rgb(24, 48, 59))
 * to light blue (age < 90d - rgb(130, 165, 179))
 */
export function getColorFromTime(datetime: string): Color {
  const age_in_h = (Date.now() - Date.parse(datetime)) / 3_600_000;
  if (age_in_h < 24) {
    return Color.fromBytes(24, 48, 59);
  } else if (age_in_h < 72) {
    return Color.fromBytes(75, 103, 123);
  } else {
    return Color.fromBytes(130, 165, 179);
  }
}
