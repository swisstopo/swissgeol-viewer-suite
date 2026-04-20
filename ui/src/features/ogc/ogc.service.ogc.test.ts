import { vi } from 'vitest';

// CRITICAL: These mocks MUST be at the very top, before any other imports.
// Vitest automatically hoists them to prevent circular dependency issues.
// See the documentation comment below for details.
vi.mock('src/features/layer/controllers/layer.controller', () => ({
  BaseLayerController: class {},
  mapLayerSourceToResource: vi.fn(),
}));
vi.mock('src/features/layer/controllers/layer-wmts.controller', () => ({
  WmtsLayerController: class {},
}));
vi.mock('src/features/layer/controllers/layer-tiles3d.controller', () => ({
  Tiles3dLayerController: class {},
}));
vi.mock('src/features/layer/controllers/layer-voxel.controller', () => ({
  VoxelLayerController: class {},
}));
vi.mock('src/features/layer/controllers/layer-tiff.controller', () => ({
  TiffLayerController: class {},
}));
vi.mock('src/features/layer/controllers/layer-kml.controller', () => ({
  KmlLayerController: class {},
}));
vi.mock('src/features/layer/controllers/layer.geojson.controller', () => ({
  GeoJsonLayerController: class {},
}));
vi.mock('src/features/layer/controllers/layer-earthquakes.controller', () => ({
  EarthquakesLayerController: class {},
}));
vi.mock('src/features/layer/controllers/layer-background.controller', () => ({
  BackgroundLayerController: class {},
}));
vi.mock('src/services/cesium.service', () => ({
  CesiumService: {
    get: () => ({
      viewerOrNull: null,
    }),
  },
}));

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OgcService, OgcJobStage, OgcJob } from 'src/features/ogc/ogc.service';
import { Cartesian3 } from 'cesium';
import {
  Layer,
  LayerType,
  LayerSourceType,
  OgcSourceType,
  WmtsLayerSource,
} from 'src/features/layer';
import { makeId } from 'src/models/id.model';
import JSZip from 'jszip';
import { writeFile, mkdir, rm, readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * OGC Service Integration Tests
 *
 * ## Test Setup and Mocking
 *
 * **IMPORTANT:** The vi.mock() calls at the top of this file MUST remain before all other imports.
 * Vitest automatically hoists these mocks to prevent circular dependency issues during module evaluation.
 *
 * ### Why Mocking is Required
 * The layer feature exports include controllers that have circular dependencies:
 * - `layer.controller.ts` imports all specific controller types for its union type
 * - Each controller (e.g., `layer-wmts.controller.ts`) extends `BaseLayerController` from `layer.controller.ts`
 * - This creates a circular import that breaks during Vitest's module evaluation
 *
 * ### What Gets Mocked
 * - **Layer Controllers**: All controller classes are mocked with empty class stubs since these tests
 *   only need layer type definitions and models, not the actual CesiumJS rendering logic
 * - **CesiumService**: Mocked to prevent viewer initialization issues in Node.js test environment
 *
 * ### Impact
 * These mocks allow the test to import layer types and models (Layer, LayerType, etc.) without
 * triggering controller initialization or causing circular dependency errors.
 *
 * ---
 *
 * ## Test Functionality
 *
 * These tests make REAL API calls to the OGC service:
 * https://ogc-api.gst-viewer.swissgeol.ch
 *
 * They test all OGC source type configurations:
 * - GST (geological data with gocad and tiles3d formats)
 * - STAC (SpatioTemporal Asset Catalog)
 * - FDSN (seismic data from ETHZ)
 * - WMS (Web Map Service from swisstopo)
 * - WMTS (Web Map Tile Service from swisstopo)
 *
 * ⚠️ IMPORTANT: These tests hit the real API and should only be run explicitly!
 * Run with: npm run test:ogc
 *
 * Tests will:
 * 1. Submit a job to the OGC API
 * 2. Poll until job completes
 * 3. Download the result file
 * 4. Extract files into a folder prefixed by the ogcSource collection
 * 5. Check for error files (stac@swisstopo_error.txt) — fail if any are found
 * 6. Clean up the job and temp files
 */

const ERROR_FILE_NAME = 'stac@swisstopo_error.txt';

describe('OgcService - Real API Integration Tests', () => {
  let service: OgcService;
  const createdJobs: OgcJob[] = [];

  const testShape: Cartesian3[] = [
    Cartesian3.fromDegrees(7.484139740740058, 46.866399208725426),
    Cartesian3.fromDegrees(7.262777583098003, 47.05193186194356),
    Cartesian3.fromDegrees(7.602817483892908, 47.24114070475815),
    Cartesian3.fromDegrees(7.823774240032048, 47.05495172711942),
  ];

  beforeEach(() => {
    service = new OgcService();
  });

  afterEach(async () => {
    // Clean up all created jobs
    for (const job of createdJobs) {
      try {
        await service.complete(job);
        console.log(`  [Cleanup] Deleted job ${job.id}`);
      } catch (error) {
        console.warn(`  [Cleanup] Failed to delete job ${job.id}:`, error);
      }
    }
    createdJobs.length = 0;

    // Clean up temp directory
    const tempDir = join(process.cwd(), 'temp-ogc-tests');
    if (existsSync(tempDir)) {
      try {
        // await rm(tempDir, { recursive: true, force: true });
        // console.log('  [Cleanup] Removed temp directory');
      } catch (error) {
        console.warn('  [Cleanup] Failed to remove temp directory:', error);
      }
    }
  });

  /**
   * Helper to wait for job completion and track progress
   */
  async function waitForJobCompletion(job: OgcJob): Promise<OgcJobStage> {
    let finalStage: OgcJobStage | null = null;

    await service.resolve(job, (stage, progressValue) => {
      finalStage = stage;
      const progressText =
        progressValue !== null ? ` - ${(progressValue * 100).toFixed(1)}%` : '';
      console.log(`  [${job.id}] ${stage}${progressText}`);
    });

    return finalStage!;
  }

  /**
   * Recursively find all files with a given name in a directory
   */
  async function findFilesRecursively(
    dir: string,
    fileName: string,
  ): Promise<string[]> {
    const results: string[] = [];
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...(await findFilesRecursively(fullPath, fileName)));
      } else if (entry.name === fileName) {
        results.push(fullPath);
      }
    }
    return results;
  }

  /**
   * Helper to download, extract, and check job result for errors
   */
  async function downloadAndVerifyJobResult(
    job: OgcJob,
    collection: string,
  ): Promise<void> {
    console.log(`  [${job.id}] Downloading result...`);

    const res = await fetch(
      `https://ogc-api.gst-viewer.swissgeol.ch/jobs/${job.id}/results`,
    );
    expect(res.status).toBe(200);

    const blob = await res.blob();
    expect(blob.size).toBeGreaterThan(0);
    console.log(`  [${job.id}] Downloaded ${blob.size} bytes`);

    // Create temporary directory: collection-timestamp-jobId
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join('-');
    const folderName = `${collection}-${timestamp}-${job.id}`;
    const tempDir = join(process.cwd(), 'temp-ogc-tests', folderName);
    if (existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true });
    }
    await mkdir(tempDir, { recursive: true });

    // Save the downloaded file
    const zipPath = join(tempDir, 'result.zip');
    const buffer = await blob.arrayBuffer();
    await writeFile(zipPath, Buffer.from(buffer));
    console.log(`  [${job.id}] Saved to ${zipPath}`);

    // Extract the zip
    console.log(`  [${job.id}] Extracting...`);
    const zip = await JSZip.loadAsync(buffer);

    for (const [filename, file] of Object.entries(zip.files)) {
      if (!file.dir) {
        const content = await file.async('nodebuffer');
        const extractPath = join(tempDir, filename);

        const parentDir = join(extractPath, '..');
        if (!existsSync(parentDir)) {
          await mkdir(parentDir, { recursive: true });
        }

        await writeFile(extractPath, content);
        console.log(`  [${job.id}]   - ${filename} (${content.length} bytes)`);
      }
    }

    // Check for error files recursively
    const errorFiles = await findFilesRecursively(tempDir, ERROR_FILE_NAME);
    if (errorFiles.length > 0) {
      const errorMessages: string[] = [];
      for (const errorFile of errorFiles) {
        const content = await readFile(errorFile, 'utf-8');
        errorMessages.push(`--- ${errorFile} ---\n${content}`);
      }
      expect.fail(
        `Found ${errorFiles.length} error file(s):\n\n${errorMessages.join('\n\n')}`,
      );
    }
  }

  describe('STAC Wmts Configuration', () => {
    it('should successfully process STAC with GeoCover collection', async () => {
      const COLLECTION_GEOCOVER = 'ch.swisstopo.geologie-geocover';
      const layer = {
        id: makeId(COLLECTION_GEOCOVER),
        type: LayerType.Wmts,
        label: 'GeoCover (STAC)',
        source: WmtsLayerSource.WMTS,
        ogcSource: {
          type: OgcSourceType.Stac,
          collection: COLLECTION_GEOCOVER,
        },
        isVisible: true,
        opacity: 1,
      } as Layer;

      console.log('\n[STAC GeoCover Test] Starting job...');
      const job = await service.start('STAC GeoCover Test', [layer], testShape);

      expect(job).not.toBeNull();
      expect(job!.id).toBeDefined();
      createdJobs.push(job!);

      console.log(`[STAC GeoCover Test] Job created: ${job!.id}`);

      const finalStage = await waitForJobCompletion(job!);
      expect(finalStage).toBe(OgcJobStage.Success);

      await downloadAndVerifyJobResult(job!, COLLECTION_GEOCOVER);
    }, 120000);

    it('should successfully process STAC with swissalti3d collection', async () => {
      const COLLECTION_SWISSALTI3D = 'ch.swisstopo.swissalti3d';
      const layer = {
        id: makeId(
          'ch.swisstopo.swissalti3d-reliefschattierung_monodirektional',
        ),
        type: LayerType.Wmts,
        label: 'swissalti3d (STAC)',
        source: WmtsLayerSource.WMTS,
        ogcSource: {
          type: OgcSourceType.Stac,
          collection: COLLECTION_SWISSALTI3D,
        },
        isVisible: true,
        opacity: 1,
      } as Layer;

      console.log('\n[STAC swissalti3d Test] Starting job...');
      const job = await service.start(
        'STAC swissalti3d Test',
        [layer],
        testShape,
      );

      expect(job).not.toBeNull();
      expect(job!.id).toBeDefined();
      createdJobs.push(job!);

      console.log(`[STAC swissalti3d Test] Job created: ${job!.id}`);

      const finalStage = await waitForJobCompletion(job!);
      expect(finalStage).toBe(OgcJobStage.Success);

      await downloadAndVerifyJobResult(job!, COLLECTION_SWISSALTI3D);
    }, 120000);

    it('should successfully process STAC with SwissBedrock GeoTIFF collection', async () => {
      const COLLECTION_SWISSBEDROCK = 'ch.swisstopo.geologie-swissbedrock';
      const layer = {
        id: makeId('ch.swisstopo.swissbedrock-geotiff'),
        type: LayerType.Tiff,
        label: 'SwissBedrock GeoTIFF (STAC)',
        source: {
          type: LayerSourceType.Ogc,
          ogcSource: {
            type: OgcSourceType.Stac,
            collection: COLLECTION_SWISSBEDROCK,
          },
        },
        isVisible: true,
        opacity: 1,
      } as Layer;

      console.log('\n[STAC SwissBedrock Test] Starting job...');
      const job = await service.start(
        'STAC SwissBedrock Test',
        [layer],
        testShape,
      );

      expect(job).not.toBeNull();
      expect(job!.id).toBeDefined();
      createdJobs.push(job!);

      console.log(`[STAC SwissBedrock Test] Job created: ${job!.id}`);

      const finalStage = await waitForJobCompletion(job!);
      expect(finalStage).toBe(OgcJobStage.Success);

      await downloadAndVerifyJobResult(job!, COLLECTION_SWISSBEDROCK);
    }, 120000);

    it('should successfully process STAC with SwissBuildings3D collection', async () => {
      const COLLECTION_SWISSBUILDINGS3D = 'ch.swisstopo.swissbuildings3d_2';
      const layer = {
        id: makeId('swiss_buildings'),
        type: LayerType.Tiles3d,
        label: 'Swiss Buildings 3D (STAC)',
        source: {
          type: LayerSourceType.Ogc,
          ogcSource: {
            type: OgcSourceType.Stac,
            collection: COLLECTION_SWISSBUILDINGS3D,
          },
        },
        isVisible: true,
        opacity: 1,
      } as Layer;

      console.log('\n[STAC SwissBuildings3D Test] Starting job...');
      const job = await service.start(
        'STAC SwissBuildings3D Test',
        [layer],
        testShape,
      );

      expect(job).not.toBeNull();
      expect(job!.id).toBeDefined();
      createdJobs.push(job!);

      console.log(`[STAC SwissBuildings3D Test] Job created: ${job!.id}`);

      const finalStage = await waitForJobCompletion(job!);
      expect(finalStage).toBe(OgcJobStage.Success);

      await downloadAndVerifyJobResult(job!, COLLECTION_SWISSBUILDINGS3D);
    }, 120000);
  });
});
