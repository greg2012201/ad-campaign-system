import { Type } from "class-transformer";
import {
  IsString,
  MinLength,
  IsInt,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsOptional,
  IsObject,
  IsUUID,
  IsEnum,
  IsUrl,
  Min,
} from "class-validator";
import { AssetTypeEnum } from "../campaign-asset.entity";

export class CreateAssetDto {
  @IsEnum(AssetTypeEnum)
  assetType: AssetTypeEnum;

  @IsString()
  @IsUrl()
  url: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMs?: number;
}

export class CreateCampaignDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsInt()
  startAt: number;

  @IsInt()
  expireAt: number;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => CreateAssetDto)
  assets: CreateAssetDto[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsUUID()
  idempotencyKey: string;
}
