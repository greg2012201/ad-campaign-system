import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bullmq";
import { CampaignEntity } from "../campaigns/campaign.entity";
import { CampaignAssetEntity } from "../campaigns/campaign-asset.entity";
import { DeviceEntity } from "../devices/device.entity";
import { PublisherProcessor } from "./publisher.processor";
import { MqttProvider } from "./mqtt.provider";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CampaignEntity,
      CampaignAssetEntity,
      DeviceEntity,
    ]),
    BullModule.registerQueue({ name: "publish" }),
    MqttProvider,
  ],
  providers: [PublisherProcessor],
})
export class PublisherModule {}
