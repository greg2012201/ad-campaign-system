export type CampaignStatus =
  | "draft"
  | "building"
  | "ready"
  | "publishing"
  | "active"
  | "completed"
  | "cancelled";

export type Campaign = {
  id: string;
  name: string;
  version: number;
  status: CampaignStatus;
  startAt: number;
  expireAt: number;
  createdAt: number;
  updatedAt: number;
};

export type CampaignAsset = {
  id: string;
  campaignId: string;
  assetType: string;
  url: string;
  checksum: string;
  durationMs: number;
  sizeBytes: number;
  createdAt: number;
};
