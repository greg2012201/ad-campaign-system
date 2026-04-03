import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bullmq";
import { ScheduleModule } from "@nestjs/schedule";
import { CampaignEntity } from "../campaigns/campaign.entity";
import { CampaignAssetEntity } from "../campaigns/campaign-asset.entity";
import { DeviceEntity } from "../devices/device.entity";
import { DeliveryEventEntity } from "../ack-consumer/delivery-event.entity";
import { PublisherProcessor } from "./publisher.processor";
import { VerifyDeliveryProcessor } from "./verify-delivery.processor";
import { DeviceStreamService } from "./device-stream.service";
import { DevicePublishTracker } from "./device-publish-tracker";
import { PublishingRecoveryService } from "./publishing-recovery.service";
import { MqttModule } from "../mqtt/mqtt.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CampaignEntity,
      CampaignAssetEntity,
      DeviceEntity,
      DeliveryEventEntity,
    ]),
    BullModule.registerQueue({ name: "publish" }),
    BullModule.registerQueue({ name: "verify-delivery" }),
    ScheduleModule.forRoot(),
    MqttModule,
  ],
  providers: [
    PublisherProcessor,
    VerifyDeliveryProcessor,
    DeviceStreamService,
    DevicePublishTracker,
    PublishingRecoveryService,
  ],
})
export class PublisherModule {}
