import { Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { DataSource } from "typeorm";
import { randomUUID } from "node:crypto";
import { TOPICS } from "@campaign-system/shared";
import type { Manifest } from "@campaign-system/shared";
import {
  CampaignEntity,
  CampaignStatusEnum,
} from "../campaigns/campaign.entity";
import { DeviceEntity } from "../devices/device.entity";
import { MqttProvider } from "./mqtt.provider";

@Injectable()
@Processor("publish")
export class PublisherProcessor extends WorkerHost {
  private readonly logger = new Logger(PublisherProcessor.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly mqttProvider: MqttProvider,
  ) {
    super();
  }

  async process(job: Job) {
    if (job.name === "campaign_cancelled") {
      return this.handleCancel(job);
    }

    return this.handlePublish(job);
  }

  private async handlePublish(job: Job) {
    const { campaignId } = job.data;

    const campaign = await this.dataSource
      .getRepository(CampaignEntity)
      .findOne({
        where: { id: campaignId },
        relations: ["assets"],
      });

    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    await this.dataSource.getRepository(CampaignEntity).update(campaignId, {
      status: CampaignStatusEnum.PUBLISHING,
    });

    const devices = await this.dataSource
      .getRepository(DeviceEntity)
      .find();

    const apiBaseUrl = "http://localhost:3000";

    const manifest: Manifest = {
      manifestId: randomUUID(),
      campaignId: campaign.id,
      version: campaign.version,
      startAt: Number(campaign.startAt),
      expireAt: Number(campaign.expireAt),
      templateUrl: `${apiBaseUrl}/templates/${campaign.id}/index.html`,
      assets: campaign.assets.map((a) => ({
        url: a.url,
        checksum: a.checksum ?? "",
        sizeBytes: Number(a.sizeBytes ?? 0),
      })),
    };

    const payload = JSON.stringify(manifest);

    for (const device of devices) {
      try {
        await this.mqttProvider.publish({
          topic: TOPICS.NOTIFICATIONS(device.deviceId),
          payload,
          qos: 1,
        });
      } catch (error) {
        this.logger.error(
          `Failed to publish to device ${device.deviceId}: ${error}`,
        );
      }
    }

    await this.dataSource.getRepository(CampaignEntity).update(campaignId, {
      status: CampaignStatusEnum.ACTIVE,
    });

    this.logger.log(
      `Campaign ${campaignId} published to ${devices.length} devices`,
    );
  }

  private async handleCancel(job: Job) {
    const { campaignId } = job.data;

    const devices = await this.dataSource
      .getRepository(DeviceEntity)
      .find();

    const controlPayload = JSON.stringify({
      type: "revoke",
      campaignId,
    });

    for (const device of devices) {
      try {
        await this.mqttProvider.publish({
          topic: TOPICS.CONTROL(device.deviceId),
          payload: controlPayload,
          qos: 1,
        });
      } catch (error) {
        this.logger.error(
          `Failed to send revoke to device ${device.deviceId}: ${error}`,
        );
      }
    }

    this.logger.log(
      `Campaign ${campaignId} revoke sent to ${devices.length} devices`,
    );
  }
}
