import { BaseService } from 'src/utils/base.service';
import { LayerConfig, LayerTreeNode, LayerType } from 'src/layertree';
import {
  ImageryLayer,
  UrlTemplateImageryProvider,
  WebMapServiceImageryProvider,
} from 'cesium';
import { sleep } from 'src/utils/fn.utils';
import * as fflate from 'fflate';

export class OgcService extends BaseService {
  async start(layers: LayerTreeNode[], bbox: BBox): Promise<OgcJob> {
    const inputs: object[] = [];
    const promises: Array<Promise<void>> = [];
    for (const layer of layers) {
      promises.push(
        this.getInputForLayer(layer, bbox).then((input) => {
          if (input !== null) {
            inputs.push(input);
          }
        }),
      );
    }
    await Promise.all(promises);
    if (promises.length === 0) {
      return NO_SUCH_JOB;
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
    const result: { jobId: string } = await res.json();
    return {
      id: result.jobId,
    };
  }

  async resolve(
    job: OgcJob,
    report: (progress: number) => void,
  ): Promise<void> {
    if (job === NO_SUCH_JOB) {
      return;
    }
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
        progress,
      }: { status: JobStatus; message: string; progress: number } =
        await res.json();
      switch (status) {
        case JobStatus.Accepted:
        case JobStatus.Running:
          report(progress / 1000);
          await sleep(500);
          continue;
        case JobStatus.Successful:
          return;
        case JobStatus.Failed:
          throw new Error(`ogc job failed: ${message}`);
        case JobStatus.Dismissed:
          return;
      }
    }
  }

  async download(job: OgcJob): Promise<void> {
    if (job === NO_SUCH_JOB) {
      return;
    }
    const res = await fetch(`http://localhost:8000/ogc/jobs/${job.id}/results`);
    const buf = new Uint8Array(await res.arrayBuffer());

    const data = await new Promise<fflate.Unzipped>((resolve, reject) => {
      fflate.unzip(buf, (err, data) => {
        if (err === null) {
          resolve(data);
        } else {
          reject(err);
        }
      });
    });

    for (const [filePath, fileData] of Object.entries(data)) {
      const blob = new Blob([fileData]);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const lastSlashIndex = filePath.lastIndexOf('/');
      a.download = filePath.slice(lastSlashIndex + 1);
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    }
  }

  async delete(job: OgcJob): Promise<void> {
    if (job === NO_SUCH_JOB) {
      return;
    }
    await fetch(`http://localhost:8000/ogc/jobs/${job.id}`, {
      method: 'DELETE',
    });
  }

  private async getInputForLayer(
    layer: LayerTreeNode,
    bbox: BBox,
  ): Promise<object | null> {
    switch (layer.type) {
      case LayerType.swisstopoWMTS: {
        const { imageryProvider } = (await (layer as unknown as LayerConfig)
          .promise) as ImageryLayer;
        console.log(layer as unknown as ImageryLayer);
        if (imageryProvider instanceof UrlTemplateImageryProvider) {
          // It's a WMTS layer.
          return {
            type: 'wmts10',
            identifier: 'wmts@swisstopo',
            layer: layer.layer,
            bbox: {
              bbox,
              epsg: 4326,
            },
          };
        } else if (imageryProvider instanceof WebMapServiceImageryProvider) {
          // It's a WMS layer.
          return {
            type: 'wms13',
            identifier: 'wms@swisstopo',
            layer: layer.layer,
            epsg: 4326,
          };
        } else {
          console.warn(
            `Unable to query ogc service for ${layer.type} layer '${layer.layer ?? layer.label}'`,
          );
          return null;
        }
      }

      default:
        console.warn(
          `Unable to query ogc service for ${layer.type} layer '${layer.layer ?? layer.label}'`,
        );
        return null;
    }
  }
}

type BBox = [number, number, number, number];

export type OgcJob = AsyncOgcJob | typeof NO_SUCH_JOB;

const NO_SUCH_JOB = Symbol('OGC/NoJob');

interface AsyncOgcJob {
  id: string;
}

enum JobStatus {
  Accepted = 'accepted',
  Running = 'running',
  Successful = 'successful',
  Failed = 'failed',
  Dismissed = 'dismissed',
}
