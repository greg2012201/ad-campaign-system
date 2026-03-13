import { Expose, Type } from "class-transformer";
import { AssetTypeEnum } from "../campaign-asset.entity";
import { CampaignStatusEnum } from "../campaign.entity";

export class AssetResponseDto {
  @Expose()
  id: string;

  @Expose()
  campaignId: string;

  @Expose()
  assetType: AssetTypeEnum;

  @Expose()
  url: string;

  @Expose()
  checksum: string | null;

  @Expose()
  durationMs: number | null;

  @Expose()
  sizeBytes: number | null;

  @Expose()
  createdAt: Date;
}

export class CampaignResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  version: number;

  @Expose()
  startAt: number;

  @Expose()
  expireAt: number;

  @Expose()
  metadata: Record<string, unknown> | null;

  @Expose()
  status: CampaignStatusEnum;

  @Expose()
  createdBy: string | null;

  @Expose()
  idempotencyKey: string | null;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  @Type(() => AssetResponseDto)
  assets: AssetResponseDto[];
}
