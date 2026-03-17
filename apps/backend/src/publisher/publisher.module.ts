import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bullmq";
import { CampaignEntity } from "../campaigns/campaign.entity";
import { CampaignAssetEntity } from "../campaigns/campaign-asset.entity";
import { DeviceEntity } from "../devices/device.entity";
import { PublisherProcessor } from "./publisher.processor";
import { MqttModule } from "./mqtt.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CampaignEntity,
      CampaignAssetEntity,
      DeviceEntity,
    ]),
    BullModule.registerQueue({ name: "publish" }),
    MqttModule,
  ],
  providers: [PublisherProcessor],
})
export class PublisherModule {}
