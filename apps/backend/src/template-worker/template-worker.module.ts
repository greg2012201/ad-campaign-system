import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bullmq";
import { CampaignEntity } from "../campaigns/campaign.entity";
import { CampaignAssetEntity } from "../campaigns/campaign-asset.entity";
import { OutboxEntity } from "../outbox/outbox.entity";
import { TemplateProcessor } from "./template.processor";
import { TemplateController } from "./template.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CampaignEntity,
      CampaignAssetEntity,
      OutboxEntity,
    ]),
    BullModule.registerQueue({ name: "template-build" }),
  ],
  controllers: [TemplateController],
  providers: [TemplateProcessor],
})
export class TemplateWorkerModule {}
