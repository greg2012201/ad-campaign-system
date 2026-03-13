import { Expose, Type } from "class-transformer";
import { IsOptional, IsEnum, IsInt, Min, Max } from "class-validator";
import { CampaignStatusEnum } from "../campaign.entity";
import { CampaignResponseDto } from "./campaign-response.dto";

export class CampaignListQueryDto {
  @IsOptional()
  @IsEnum(CampaignStatusEnum)
  status?: CampaignStatusEnum;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset: number = 0;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit: number = 20;
}

export class CampaignListResponseDto {
  @Expose()
  @Type(() => CampaignResponseDto)
  data: CampaignResponseDto[];

  @Expose()
  total: number;

  @Expose()
  offset: number;

  @Expose()
  limit: number;
}
