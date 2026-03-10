export type ManifestAsset = {
  url: string;
  checksum: string;
  sizeBytes: number;
};

export type Manifest = {
  manifestId: string;
  campaignId: string;
  version: number;
  startAt: number;
  expireAt: number;
  templateUrl: string;
  assets: ManifestAsset[];
};
