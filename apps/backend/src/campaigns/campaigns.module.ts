import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CampaignEntity } from "./campaign.entity";
import { CampaignAssetEntity } from "./campaign-asset.entity";
import { CampaignsController } from "./campaigns.controller";
import { CampaignsService } from "./campaigns.service";
import { DeliveryEventEntity } from "../ack-consumer/delivery-event.entity";
import { DeviceEntity } from "../devices/device.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CampaignEntity,
      CampaignAssetEntity,
      DeliveryEventEntity,
      DeviceEntity,
    ]),
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
