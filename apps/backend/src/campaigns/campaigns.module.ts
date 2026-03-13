import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CampaignEntity } from "./campaign.entity";
import { CampaignAssetEntity } from "./campaign-asset.entity";
import { CampaignsController } from "./campaigns.controller";
import { CampaignsService } from "./campaigns.service";

@Module({
  imports: [TypeOrmModule.forFeature([CampaignEntity, CampaignAssetEntity])],
  controllers: [CampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
