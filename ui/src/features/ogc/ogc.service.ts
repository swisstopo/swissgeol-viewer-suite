import { BaseService } from 'src/utils/base.service';
import { LayerConfig, LayerTreeNode, LayerType } from 'src/layertree';
import {
  Cartesian3,
  Cartographic,
  ImageryLayer,
  UrlTemplateImageryProvider,
  WebMapServiceImageryProvider,
  Math as CesiumMath,
  GeoJsonDataSource,
  Cesium3DTileset,
  Resource,
} from 'cesium';
import { sleep } from 'src/utils/fn.utils';
import { BehaviorSubject, Observable } from 'rxjs';
import MainStore from 'src/store/main';

export class OgcService extends BaseService {
  private readonly jobsSubject = new BehaviorSubject<OgcJob[]>([]);

  constructor() {
    super();
    MainStore.viewer.subscribe(async (viewer) => {
      if (!viewer) {
        return;
      }
      // this.loadGeoJsonLayer('13325').then((layer) => {
      //   viewer.dataSources.add(layer);
      //   viewer.zoomTo(layer);
      // });
      this.loadTiles3dLayerStyles('13327', '5').then((layer) => {
        viewer.scene.primitives.add(layer);
        viewer.zoomTo(layer);
      });
      // this.loadTiles3dLayer('10486').then((layer) => {
      //   viewer.scene.primitives.add(layer);
      //   viewer.zoomTo(layer);
      // });
    });
  }

  async loadGeoJsonLayer(id: string): Promise<GeoJsonDataSource> {
    const res = await fetch(
      `http://localhost:8000/ogc/collections/${id}/items`,
      {
        headers: {
          Authorization: 'Basic ' + btoa('OGC-Seismics:pw'),
        },
      },
    );
    const geojson = await res.json();
    return await GeoJsonDataSource.load(geojson);
  }

  async loadTiles3dLayer(id: string): Promise<Cesium3DTileset> {
    const resource = new Resource({
      url: `http://localhost:8000/ogc/collections/${id}/download_format/tiles3d`,
      headers: {
        Authorization: 'Basic ' + btoa('OGC-Seismics:pw'),
      },
    });

    return Cesium3DTileset.fromUrl(resource);
  }

  async loadTiles3dLayerStyles(
    id: string,
    styleId: string,
  ): Promise<Cesium3DTileset> {
    const resource = new Resource({
      url: `https://ogc-api.gst-viewer.swissgeol.ch/collections/${id}/styles/${styleId}/download_format/tiles3d`,
      headers: {
        Authorization: 'Basic ' + btoa('OGC-Seismics:pw'),
      },
    });

    return Cesium3DTileset.fromUrl(resource);
  }

  get jobs$(): Observable<OgcJob[]> {
    return this.jobsSubject.asObservable();
  }

  async isLayerSupported(layer: LayerTreeNode): Promise<boolean> {
    return (await this.getInputForLayer(layer, [])) !== null;
  }

  async start(
    title: string,
    layers: LayerTreeNode[],
    shape: Cartesian3[],
  ): Promise<OgcJob | null> {
    const inputs: object[] = [];
    const promises: Array<Promise<void>> = [];
    for (const layer of layers) {
      promises.push(
        this.getInputForLayer(layer, shape, {
          shouldWarnIfNotAvailable: true,
        }).then((input) => {
          if (input !== null) {
            inputs.push(input);
          }
        }),
      );
    }
    await Promise.all(promises);
    if (promises.length === 0) {
      return null;
    }

    const res = await fetch(
      'http://localhost:8000/ogc/processes/FeaturesInBoundingBox/execution',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Prefer: 'respond-async',
        },
        body: JSON.stringify({
          inputs: {
            downloadInput: inputs,
          },
          outputs: {
            output: {
              transmissionMode: 'value',
            },
          },
          response: 'raw',
        }),
      },
    );
    if (res.status < 200 || res.status > 299) {
      throw new Error(
        `Failed to access ogc api: [${res.status} ${res.statusText}] ${await res.text()}`,
      );
    }
    const result: { jobID: string } = await res.json();
    const job: OgcJob = {
      id: result.jobID,
      title,
      layers,
    };
    this.jobsSubject.next([...this.jobsSubject.value, job]);
    return job;
  }

  async resolve(
    job: OgcJob,
    report: (stage: OgcJobStage, progress: number | null) => void,
  ): Promise<void> {
    while (true) {
      const res = await fetch(
        `http://localhost:8000/ogc/jobs/${job.id}?t=json`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        },
      );
      if (res.status === 404) {
        return;
      }
      if (res.status < 200 || res.status > 299) {
        throw new Error(
          `Failed to access ogc api: [${res.status} ${res.statusText}] ${await res.text()}`,
        );
      }
      const {
        status,
        message,
        progress: progressValue,
      }: {
        status: JobStatusFromApi;
        message: string;
        progress: number;
      } = await res.json();
      const progress = isNaN(Number(progressValue))
        ? null
        : Number(progressValue) / 1000;

      let lastMessage: [OgcJobStage, number | null] | null = null;
      const send = async (stage: OgcJobStage, progress: number | null) => {
        if (
          lastMessage === null ||
          lastMessage[0] !== stage ||
          lastMessage[1] !== progress
        ) {
          report(stage, progress);
          lastMessage = [stage, progress];
          await sleep(500);
        }
      };

      switch (status) {
        case JobStatusFromApi.Accepted:
          await send(OgcJobStage.Prepare, progress);
          continue;
        case JobStatusFromApi.Running:
          await send(OgcJobStage.Running, progress);
          continue;
        case JobStatusFromApi.Successful:
          await send(OgcJobStage.Success, null);
          return;
        case JobStatusFromApi.Failed:
          console.error(`ogc job failed: ${message}`);
          await send(OgcJobStage.Failure, null);
          return;
        case JobStatusFromApi.Dismissed:
          await send(OgcJobStage.Complete, null);
          return;
      }
    }
  }

  async download(job: OgcJob): Promise<void> {
    const res = await fetch(`http://localhost:8000/ogc/jobs/${job.id}/results`);
    const blob = await res.blob();

    const a = document.createElement('a');
    a.download = job.title
      .split('')
      .map((char) => {
        if (/\s/.test(char)) {
          return '_';
        }
        return /[A-Za-z0-9_\-.]/.test(char) ? char : '';
      })
      .join('');
    a.href = URL.createObjectURL(blob);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  async complete(job: OgcJob): Promise<void> {
    await fetch(`http://localhost:8000/ogc/jobs/${job.id}`, {
      method: 'DELETE',
    });
    const i = this.jobsSubject.value.findIndex((it) => it.id === job.id);
    if (i !== undefined) {
      const newJobs = [...this.jobsSubject.value];
      newJobs.splice(i, 1);
      this.jobsSubject.next(newJobs);
    }
  }

  private async getInputForLayer(
    layer: LayerTreeNode,
    shape: Cartesian3[],
    options: { shouldWarnIfNotAvailable?: boolean } = {},
  ): Promise<object | null> {
    const points = shape.map((position) => {
      const carto = Cartographic.fromCartesian(position);
      const lon = CesiumMath.toDegrees(carto.longitude);
      const lat = CesiumMath.toDegrees(carto.latitude);
      return [lat, lon];
    });
    if (points.length !== 0) {
      points.push(points[0]);
    }

    const requestArea = {
      epsg: 4326,
      polygon: points,
    };
    if (layer.gstId != null) {
      // It's a GST layer.
      return {
        type: 'gst',
        id: Number(layer.gstId),
        requestedFormat: 'tiles3d',
        requestVolume: {
          ...requestArea,
          polygon: {
            points,
            zMax: 100_000,
            zMin: -100_000,
          },
        },
      };
    }
    if (layer.type === LayerType.swisstopoWMTS) {
      const { imageryProvider } = (await (layer as unknown as LayerConfig)
        .promise) as ImageryLayer;
      if (imageryProvider instanceof UrlTemplateImageryProvider) {
        // It's a WMTS layer.
        return {
          type: 'wmts10',
          identifier: 'wmts@swisstopo',
          layer: layer.layer,
          requestArea,
          width: 4_000,
          height: 4_000,
        };
      } else if (imageryProvider instanceof WebMapServiceImageryProvider) {
        // It's a WMS layer.
        return {
          type: 'wms13',
          identifier: 'wms@swisstopo',
          layer: layer.layer,
          requestArea,
          width: 4_000,
          height: 4_000,
        };
      } else {
        if (options.shouldWarnIfNotAvailable) {
          console.warn(
            `Unable to query ogc service for ${layer.type} layer '${layer.layer ?? layer.label}'`,
          );
        }
        return null;
      }
    }

    if (options.shouldWarnIfNotAvailable) {
      console.warn(
        `Unable to query ogc service for ${layer.type} layer '${layer.layer ?? layer.label}'`,
      );
    }
    return null;
  }
}

export type BBox = [number, number, number, number];

export interface OgcJob {
  id: string;
  layers: LayerTreeNode[];
  title: string;
}

export enum OgcJobStage {
  Prepare = 'Prepare',
  Running = 'Running',
  Success = 'Success',
  Failure = 'Failure',
  Complete = 'Complete',
}

enum JobStatusFromApi {
  Accepted = 'accepted',
  Running = 'running',
  Successful = 'successful',
  Failed = 'failed',
  Dismissed = 'dismissed',
}
