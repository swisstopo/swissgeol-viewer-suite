import { BaseService } from 'src/utils/base.service';
import {
  Layer,
  LayerSourceType,
  LayerType,
  Tiles3dLayer,
} from 'src/features/layer';
import { clientConfigContext } from 'src/context';
import { makeId } from 'src/models/id.model';

export class IonService extends BaseService {
  async fetchLayers(options: { accessToken?: string } = {}): Promise<Layer[]> {
    const assets = await this.fetchIonAssets(options.accessToken);
    if (assets.items === undefined) {
      throw new Error(
        `Failed to load assets from Cesium Ion: ${assets.message}`,
      );
    }
    return assets.items.map((it) =>
      this.mapAssetToLayer(it, options.accessToken),
    );
  }

  private readonly mapAssetToLayer = (
    asset: IonAsset,
    accessToken?: string,
  ): Layer => {
    switch (asset.type) {
      case '3DTILES':
        return {
          type: LayerType.Tiles3d,
          id: makeId(asset.id),
          source: {
            type: LayerSourceType.CesiumIon,
            assetId: asset.id,
            accessToken: accessToken ?? undefined,
          },
          label: asset.name,
          opacity: 1,
          canUpdateOpacity: true,
          isVisible: true,
          geocatId: null,
          downloadUrl: null,
          legend: null,
          orderOfProperties: [],
          isPartiallyTransparent: false,
        } satisfies Tiles3dLayer;
      default:
        throw new Error(`Unsupported asset type: ${ionAsset.type}`);
    }
  };

  private async fetchIonAssets(
    accessToken?: string,
  ): Promise<{ items?: IonAsset[]; message?: string }> {
    const url = new URL('https://api.cesium.com/v1/assets');

    url.searchParams.set('status', 'COMPLETE' satisfies AssetStatus);
    url.searchParams.set('type', '3DTILES' satisfies AssetType);

    accessToken ??= BaseService.get(clientConfigContext).ionDefaultAccessToken;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return await response.json();
  }
}

interface IonAsset {
  archivable: boolean;
  attribution: string;
  bytes: number;
  dateAdded: string;
  description: string;
  exportable: boolean;
  id: number;
  name: string;
  percentComplete: number;
  status: AssetStatus;
  type: AssetType;
}

type AssetStatus =
  | 'AWAITING_FILES'
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETE'
  | 'ERROR'
  | 'DATA_ERROR';

type AssetType =
  | '3DTILES'
  | 'GLTF'
  | 'IMAGERY'
  | 'TERRAIN'
  | 'KML'
  | 'CZML'
  | 'GEOJSON';
