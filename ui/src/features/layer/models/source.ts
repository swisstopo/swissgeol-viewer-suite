export type LayerSource =
  | LayerSourceForCesiumIon
  | LayerSourceForUrl
  | LayerSourceForS3;

export enum LayerSourceType {
  CesiumIon = 'CesiumIon',
  Url = 'Url',
  S3 = 'S3',
}

export interface LayerSourceForCesiumIon {
  type: LayerSourceType.CesiumIon;
  assetId: number;
}

export interface LayerSourceForUrl {
  type: LayerSourceType.Url;
  url: string;
}

export interface LayerSourceForS3 {
  type: LayerSourceType.S3;
  bucket: string;
  key: string;
}
